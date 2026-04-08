from flask import Blueprint, jsonify, request, send_file, current_app
from flask_cors import CORS
from app.models import Invoice, Quotation, PurchaseOrder, PurchaseInvoice, Item, CreditNote, DebitNote
from app.extensions import db
from app.services.mail_service import send_email
from app.services.pdf_service import (
    generate_invoice_pdf, 
    generate_quotation_pdf, 
    generate_purchase_order_pdf, 
    generate_purchase_invoice_pdf
)
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
import os
import traceback
import base64
import datetime

def get_base_url():
    """
    Build the correct base URL, honouring reverse-proxy headers.
    Priority:
      1. BASE_URL env variable (most explicit, set this on the live server)
      2. X-Forwarded-Proto header (set by Nginx/IIS/Apache)
      3. request.host_url (Flask default, always http:// locally)
    """
    base_url = os.getenv("BASE_URL")
    if base_url:
        return base_url.rstrip('/')
    
    proto = request.headers.get("X-Forwarded-Proto", "")
    if proto:
        host = request.headers.get("X-Forwarded-Host") or request.host
        return f"{proto}://{host}"
    
    return request.host_url.rstrip('/')

share_blueprint = Blueprint('share', __name__)

def get_serializer():
    return URLSafeTimedSerializer(os.getenv("SECRET_KEY", "default-secret-key"))

def generate_pdf_token(uuid, obj_type):
    s = get_serializer()
    return s.dumps({"uuid": uuid, "type": obj_type})

def verify_pdf_token(token, max_age=86400):  # 24 hours expiry
    s = get_serializer()
    try:
        data = s.loads(token, max_age=max_age)
        return data["uuid"], data["type"]
    except (SignatureExpired, BadSignature):
        return None, None

def _get_items_data(entity):
    """Refactored from individual routes to build items_data for PDF service"""
    items_data = []
    for item in entity.items:
        item_info = {
            "uuid": str(item.uuid),
            "item_id": str(item.item_id) if item.item_id else None,
            "description": item.description,
            "quantity": float(item.quantity) if item.quantity else 0,
            "unit_price": float(item.unit_price) if item.unit_price else 0,
            "discount": item.discount or {},
            "tax": item.tax or {},
            "total_price": float(item.total_price) if item.total_price else 0,
        }
        
        if item.item_id:
            inventory_item = Item.query.get(item.item_id)
            if inventory_item:
                item_info["product_name"] = inventory_item.item_name
                item_info["hsn_sac_code"] = inventory_item.hsn_code
                
                # Fetch image if available
                main_image_obj = next((img for img in (inventory_item.images or []) if img.is_main), None)
                if not main_image_obj and inventory_item.images:
                    main_image_obj = inventory_item.images[0]
                if main_image_obj and main_image_obj.image:
                    img_raw = main_image_obj.image
                    # Robust handling for bytes vs string paths/data
                    if isinstance(img_raw, str):
                        if img_raw.startswith("data:"):
                            item_info["image"] = img_raw
                        else:
                            # Item images are nested: static/itemImages/<item_uuid>/<filename>
                            images_dir = current_app.config.get('ITEM_IMAGES_FOLDER')
                            if images_dir:
                                item_uuid = str(main_image_obj.item_id)
                                # Primary: try standard nested path
                                p = os.path.join(images_dir, item_uuid, img_raw)
                                
                                # Fallback: scan all subfolders for the filename (robust for manual uploads)
                                if not os.path.exists(p):
                                    for folder in os.listdir(images_dir):
                                        candidate_p = os.path.join(images_dir, folder, img_raw)
                                        if os.path.exists(candidate_p):
                                            p = candidate_p
                                            break
                                
                                # Final verification
                                if os.path.exists(p):
                                    print(f"--- PDF Item Image Debug ---")
                                    print(f"Found image: {p}")
                                    with open(p, "rb") as f:
                                        encoded_string = base64.b64encode(f.read()).decode("utf-8")
                                        ext = os.path.splitext(p)[1].lower()
                                        mime = "image/png" if ext == ".png" else "image/jpeg"
                                        item_info["image"] = f"data:{mime};base64,{encoded_string}"
                                else:
                                    print(f"--- PDF Item Image MISSING ---")
                                    print(f"Key: {img_raw}, Tried: {p}")
                    else:
                        # It's already bytes (binary column)
                        item_info["image"] = f"data:image/jpeg;base64,{base64.b64encode(img_raw).decode('utf-8')}"
        
        items_data.append(item_info)
    return items_data

@share_blueprint.route('/<uuid>', methods=['GET'])
def get_share_data(uuid):
    try:
        obj_type = request.args.get('type', 'invoice')
        
        entity = None
        number_field = 'invoice_number'
        date_field = 'invoice_date'
        display_type = 'Invoice'

        if obj_type == 'invoice':
            entity = Invoice.query.filter_by(uuid=uuid).first()
            number_field = 'invoice_number'
            date_field = 'invoice_date'
            display_type = 'Invoice'
        elif obj_type == 'quotation':
            entity = Quotation.query.filter_by(uuid=uuid).first()
            number_field = 'quotation_number'
            date_field = 'quotation_date'
            display_type = 'Quotation'
        elif obj_type == 'purchase_order':
            entity = PurchaseOrder.query.filter_by(uuid=uuid).first()
            number_field = 'po_number'
            date_field = 'po_date'
            display_type = 'Purchase Order'
        elif obj_type == 'purchase_invoice':
            entity = PurchaseInvoice.query.filter_by(uuid=uuid).first()
            number_field = 'invoice_number'
            date_field = 'invoice_date'
            display_type = 'Purchase Invoice'
        elif obj_type == 'credit_note':
            entity = CreditNote.query.filter_by(uuid=uuid).first()
            number_field = 'credit_note_number'
            date_field = 'credit_note_date'
            display_type = 'Credit Note'
        elif obj_type == 'debit_note':
            entity = DebitNote.query.filter_by(uuid=uuid).first()
            number_field = 'debit_note_number'
            date_field = 'debit_note_date'
            display_type = 'Debit Note'

        if not entity:
            return jsonify({"success": False, "error": f"{obj_type} not found"}), 404

        # Generate Public Secure Link (HTTPS-aware for reverse proxy)
        token = generate_pdf_token(uuid, obj_type)
        api_base_url = get_base_url()
        public_pdf_url = f"{api_base_url}/api/share-data/public/pdf/{token}"
        
        contact = entity.customer if obj_type in ['invoice', 'quotation', 'credit_note'] else entity.vendor
        doc_number = getattr(entity, number_field, "N/A")
        total_amount = float(getattr(entity, 'total_amount', 0))
        doc_date_obj = getattr(entity, date_field, datetime.datetime.now())
        doc_date_str = doc_date_obj.strftime("%d %b %Y") if isinstance(doc_date_obj, (datetime.datetime, datetime.date)) else str(doc_date_obj)

        # Polished WhatsApp Message Format
        message = (
            f"Hi Sir/Ma'am,\n\n"
            f"Your {display_type} (No: {doc_number}) for ₹{total_amount:,.2f} has been successfully created on {doc_date_str}.\n\n"
            f"You can view or download your {display_type.lower()} here:\n"
            f"{public_pdf_url}\n\n"
            f"Thank you,\n"
            f"Evoto Technologies"
        )

        share_info = {
            "invoiceNumber": doc_number,
            "totalAmount": total_amount,
            "pdfUrl": public_pdf_url,
            "message": message, # Added message for WhatsApp
            "contact": {
                "name": f"{contact.first_name} {contact.last_name}" if hasattr(contact, 'first_name') and contact.first_name else getattr(contact, 'vendor_name', 'Client'),
                "email": getattr(contact, 'email', ''),
                "mobile": getattr(contact, 'mobile', '')
            } if contact else None
        }

        return jsonify({"success": True, "data": share_info})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@share_blueprint.route('/public/pdf/<token>', methods=['GET'])
def get_public_pdf(token):
    """Unauthenticated access to PDF via secure token"""
    uuid, obj_type = verify_pdf_token(token)
    
    if not uuid:
        return "Invalid or expired download link", 401
    
    try:
        entity = None
        pdf_func = None
        filename = f"{obj_type}_{uuid[:8]}.pdf"

        if obj_type == 'invoice':
            entity = Invoice.query.filter_by(uuid=uuid).first()
            pdf_func = generate_invoice_pdf
            filename = f"Invoice_{entity.invoice_number}.pdf" if entity else filename
        elif obj_type == 'quotation':
            entity = Quotation.query.filter_by(uuid=uuid).first()
            pdf_func = generate_quotation_pdf
            filename = f"Quotation_{entity.quotation_number}.pdf" if entity else filename
        elif obj_type == 'purchase_order':
            entity = PurchaseOrder.query.filter_by(uuid=uuid).first()
            pdf_func = generate_purchase_order_pdf
            filename = f"PO_{entity.po_number}.pdf" if entity else filename
        elif obj_type == 'purchase_invoice':
            entity = PurchaseInvoice.query.filter_by(uuid=uuid).first()
            pdf_func = generate_purchase_invoice_pdf
            filename = f"PurchaseInv_{entity.invoice_number}.pdf" if entity else filename
        elif obj_type == 'credit_note':
            from app.services.pdf_service import generate_credit_note_pdf
            entity = CreditNote.query.filter_by(uuid=uuid).first()
            pdf_func = generate_credit_note_pdf
            filename = f"CreditNote_{entity.credit_note_number}.pdf" if entity else filename
        elif obj_type == 'debit_note':
            from app.services.pdf_service import generate_debit_note_pdf
            entity = DebitNote.query.filter_by(uuid=uuid).first()
            pdf_func = generate_debit_note_pdf
            filename = f"DebitNote_{entity.debit_note_number}.pdf" if entity else filename

        if not entity:
            return "Document not found", 404

        items_data = _get_items_data(entity)
        pdf_buffer = pdf_func(entity, items_data)
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        traceback.print_exc()
        return f"Error generating PDF: {str(e)}", 500

@share_blueprint.route('/send-email', methods=['POST'])
def send_share_email():
    try:
        data = request.json
        uuid = data.get('uuid')
        obj_type = data.get('type', 'invoice')
        target_email = data.get('email')
        
        entity = None
        number_field = 'invoice_number'
        display_type = 'Invoice'

        if obj_type == 'invoice':
            entity = Invoice.query.filter_by(uuid=uuid).first()
            number_field = 'invoice_number'
            display_type = 'Invoice'
        elif obj_type == 'quotation':
            entity = Quotation.query.filter_by(uuid=uuid).first()
            number_field = 'quotation_number'
            display_type = 'Quotation'
        elif obj_type == 'purchase_order':
            entity = PurchaseOrder.query.filter_by(uuid=uuid).first()
            number_field = 'po_number'
            display_type = 'Purchase Order'
        elif obj_type == 'purchase_invoice':
            entity = PurchaseInvoice.query.filter_by(uuid=uuid).first()
            number_field = 'invoice_number'
            display_type = 'Purchase Invoice'
        elif obj_type == 'credit_note':
            entity = CreditNote.query.filter_by(uuid=uuid).first()
            number_field = 'credit_note_number'
            display_type = 'Credit Note'
        elif obj_type == 'debit_note':
            entity = DebitNote.query.filter_by(uuid=uuid).first()
            number_field = 'debit_note_number'
            display_type = 'Debit Note'

        if not entity:
            return jsonify({"success": False, "error": "Document not found"}), 404

        contact = entity.customer if obj_type in ['invoice', 'quotation', 'credit_note'] else entity.vendor
        email_to = target_email or (contact.email if contact else None)
        
        if not email_to:
            return jsonify({"success": False, "error": "No recipient email provided"}), 400

        doc_number = getattr(entity, number_field, "N/A")
        total_amount = float(getattr(entity, 'total_amount', 0))
        
        # Generate Public Secure Link (HTTPS-aware for reverse proxy)
        token = generate_pdf_token(uuid, obj_type)
        api_base_url = get_base_url()
        public_pdf_url = f"{api_base_url}/api/share-data/public/pdf/{token}"
        
        subject = f"{display_type} #{doc_number} from Evoto Technologies"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: #1B84FF;">Document Shared</h2>
            <p>Hello,</p>
            <p>You have received a <strong>{display_type.lower()}</strong> from Evoto Technologies.</p>
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">#{doc_number}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">₹{total_amount:,.2f}</td>
                </tr>
            </table>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{public_pdf_url}" style="background-color: #1B84FF; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download PDF</a>
            </div>
            <p style="color: #666; font-size: 13px;">If the button doesn't work, copy and paste this link:<br>{public_pdf_url}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">Thank you for using our service.</p>
        </div>
        """
        
        text_content = f"Hello, you have received document #{doc_number} (Amount: ₹{total_amount:,.2f}). Download here: {public_pdf_url}"
        
        success = send_email(email_to, subject, html_content, text_content)
        
        if success:
            return jsonify({"success": True, "message": "Email sent successfully"})
        else:
            return jsonify({"success": False, "error": "Failed to send email through server"}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@share_blueprint.route('/log', methods=['POST'])
def log_share_activity():
    try:
        data = request.json
        return jsonify({"success": True, "message": "Share activity logged"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
