"""
PDF Generation Service
─────────────────────
Uses xhtml2pdf (pisa) to render Jinja2 HTML templates into downloadable A4 PDFs.
Supports: Invoice, Quotation (easily extensible to other document types).
"""

from io import BytesIO
from flask import render_template
from xhtml2pdf import pisa
import os
import base64
import math
from app.models.business import GlobalConfig
from app.config import Config

from PIL import Image

try:
    from num2words import num2words
except ImportError:
    num2words = None

def get_amount_in_words(amount):
    if num2words is None or amount is None:
        return ""
    try:
        amount_float = float(amount)
        rupees = math.floor(amount_float)
        paise = int(round((amount_float - rupees) * 100))
        
        words = num2words(rupees, lang='en_IN').title() + " Rupees"
        if paise > 0:
            words += f" And {num2words(paise, lang='en_IN').title()} Paise"
        
        return words
    except Exception:
        return ""

def get_business_asset_data_uri(business_id, key):
    """
    Fetch a business asset (logo or e-sign) from GlobalConfig, 
    decode the file, and return as a base64 data URI.
    """
    config = GlobalConfig.query.filter_by(business_id=business_id, key=key).first()
    if not config:
        return None
        
    # Construct the absolute path on the filesystem
    # config.value is something like 'site_logo_1.png'
    asset_path = os.path.join(Config.BUSINESS_ASSETS_FOLDER, config.value)
    
    if os.path.exists(asset_path):
        try:
            with Image.open(asset_path) as img:
                # Determine format based on extension
                ext = os.path.splitext(asset_path)[1].lower()
                mime = "image/png" if ext == ".png" else "image/jpeg"
                
                # If transparent PNG, might need conversion for some PDF engines, 
                # but xhtml2pdf handles PNG well. 
                # For consistency with existing logic:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGBA")
                    background = Image.new("RGBA", img.size, (255, 255, 255))
                    background.paste(img, mask=img)
                    img = background.convert("RGB")
                    mime = "image/jpeg"
                
                buffer = BytesIO()
                # Save back to buffer to get base64
                if mime == "image/jpeg":
                    img.save(buffer, format="JPEG", quality=95)
                else:
                    img.save(buffer, format="PNG")
                    
                encoded_string = base64.b64encode(buffer.getvalue()).decode("utf-8")
                return f"data:{mime};base64,{encoded_string}"
        except Exception as e:
            print(f"Error processing PDF asset {key}: {e}")
            try:
                # Fallback: just read the raw bytes if PIL fails
                with open(asset_path, "rb") as f:
                    encoded_string = base64.b64encode(f.read()).decode("utf-8")
                    ext = os.path.splitext(asset_path)[1].lower()
                    mime = "image/png" if ext == ".png" else "image/jpeg"
                    return f"data:{mime};base64,{encoded_string}"
            except:
                pass
                
    return None

def get_logo_data_uri(business_id=None):
    if business_id:
        uri = get_business_asset_data_uri(business_id, 'site_logo')
        if uri:
            return uri

    # Fallback to default logo
    logo_path = os.environ.get("LOGO_PATH") or os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../otoi.web-main/public/media/app/Evoto-Logo.png")
    )
    
    if os.path.exists(logo_path):
        try:
            with open(logo_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
            return f"data:image/png;base64,{encoded_string}"
        except Exception:
            pass
            
    return ""

def get_esign_data_uri(business_id):
    return get_business_asset_data_uri(business_id, 'e_sign')

def get_font_path():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "../templates/pdf/Roboto-Regular.ttf"))

def _render_pdf(template_name: str, context: dict) -> BytesIO:
    """
    Render an HTML template with the given context and convert to PDF bytes.

    Args:
        template_name: Path to the Jinja2 template (relative to templates/).
        context: Dictionary of variables passed to the template.

    Returns:
        A BytesIO buffer containing the generated PDF.
    """
    html_string = render_template(template_name, **context)
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_string, dest=buffer, encoding="utf-8")

    if pisa_status.err:
        raise RuntimeError(f"PDF generation failed with {pisa_status.err} error(s)")

    buffer.seek(0)
    return buffer


# ── Invoice PDF ──────────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice, items_data: list) -> BytesIO:
    """
    Generate a professional A4 PDF for an Invoice.

    Args:
        invoice: Invoice SQLAlchemy model instance (with relationships loaded).
        items_data: Pre-built list of dicts with item details (product_name, hsn, etc).

    Returns:
        BytesIO buffer with the PDF content.
    """
    business = invoice.business
    customer = invoice.customer

    # Try to get the business address (first address linked to the business)
    business_address = None
    if business and business.addresses:
        business_address = business.addresses[0]

    # Get quotation number if linked
    quotation_number = None
    if invoice.quotation_id and invoice.quotation:
        quotation_number = invoice.quotation.quotation_number

    charges = invoice.charges or {}
    notes = invoice.additional_notes or {}

    # Build typed dicts for template safety
    items = []
    for item in items_data:
        raw_discount = item.get("discount") or {}
        discount_pct = raw_discount.get("discount_percentage", 0)
        if isinstance(discount_pct, dict):
            discount_pct = discount_pct.get("discount_percentage", 0)

        raw_tax = item.get("tax") or {}
        tax_pct = raw_tax.get("tax_percentage", 0)
        if isinstance(tax_pct, dict):
            tax_pct = tax_pct.get("tax_percentage", 0)
            
        fixed_discount = {
            "discount_percentage": discount_pct if discount_pct else 0,
            "discount_amount": raw_discount.get("discount_amount", 0)
        }
        
        fixed_tax = {
            "tax_percentage": tax_pct if tax_pct else 0,
            "tax_amount": raw_tax.get("tax_amount", 0)
        }

        qty = float(item.get("quantity", 0))
        if qty.is_integer():
            qty = int(qty)

        items.append({
            "product_name": item.get("product_name", ""),
            "description": item.get("description", ""),
            "image": item.get("image", ""),
            "hsn_sac_code": item.get("hsn_sac_code", ""),
            "quantity": qty,
            "unit_price": item.get("unit_price", 0),
            "discount": fixed_discount,
            "tax": fixed_tax,
            "total_price": item.get("total_price", 0),
        })

    tax_total = float(charges.get("tax_total", 0) or 0)
    subtotal = float(charges.get("subtotal", 0) or 0)
    discount_total = float(charges.get("discount_total", 0) or 0)
    taxable_amount = subtotal - discount_total

    cgst = float(charges.get("cgst", 0) or 0)
    cgst_rate = float(charges.get("cgst_rate", 0) or 0)
    sgst = float(charges.get("sgst", 0) or 0)
    sgst_rate = float(charges.get("sgst_rate", 0) or 0)
    igst = float(charges.get("igst", 0) or 0)
    igst_rate = float(charges.get("igst_rate", 0) or 0)
    utgst = float(charges.get("utgst", 0) or 0)
    utgst_rate = float(charges.get("utgst_rate", 0) or 0)

    # Auto-calculate breakdown if missing
    if tax_total > 0 and not any([cgst, sgst, igst, utgst]):
        total_rate = round((tax_total / taxable_amount) * 100, 2) if taxable_amount > 0 else 0
        half_rate = total_rate / 2.0
        half_tax = tax_total / 2.0
        
        b_state = (business_address.state or "").strip().lower() if business_address else ""
        
        cgst = half_tax
        cgst_rate = half_rate
        
        ut_keywords = ['andaman', 'chandigarh', 'dadra', 'daman', 'lakshadweep', 'delhi', 'puducherry', 'ladakh', 'jammu']
        is_ut = any(ut in b_state for ut in ut_keywords) if b_state else False
        
        if is_ut:
            utgst = half_tax
            utgst_rate = half_rate
        else:
            sgst = half_tax
            sgst_rate = half_rate

    # ── Resolve shipping address (from Shipping model, fallback to billing) ──
    ship = None
    if customer and hasattr(customer, 'default_shipping'):
        ship = customer.default_shipping

    customer_ctx = None
    if customer:
        customer_ctx = {
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "mobile": customer.mobile,
            "email": customer.email,
            "gst": customer.gst,
            # Billing address (flat columns on Customer)
            "address1": customer.address1,
            "address2": customer.address2,
            "city": customer.city,
            "state": customer.state,
            "country": customer.country,
            "pin": customer.pin,
            # Shipping address (from Shipping model, fallback to billing)
            "shipping_address1": (ship.address1 if ship else None) or customer.address1,
            "shipping_address2": None,  # Shipping model has no address2
            "shipping_city": (ship.city if ship else None) or customer.city,
            "shipping_state": (ship.state if ship else None) or customer.state,
            "shipping_country": (ship.country if ship else None) or customer.country,
            "shipping_pin": (ship.pin if ship else None) or customer.pin,
        }

    context = {
        "invoice": {
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date.strftime("%d %b %Y") if invoice.invoice_date else "—",
            "due_date": invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "—",
            "quotation_id": invoice.quotation_id,
            "total_amount": float(invoice.total_amount or 0),
            "amount_in_words": get_amount_in_words(float(invoice.total_amount or 0)),
            "amount_paid": float(invoice.amount_paid or 0),
            "balance_due": float(invoice.balance_due or 0),
            "payment_discount": float(invoice.payment_discount or 0),
            "payment_status": invoice.payment_status or "unpaid",
        },
        "logo_data_uri": get_logo_data_uri(business.id if business else None),
        "esign_data_uri": get_esign_data_uri(business.id if business else None),
        "roboto_font_path": get_font_path(),
        "business": {
            "name": business.name if business else "",
            "phone_number": business.phone_number if business else "",
            "email": business.email if business else "",
            "gst_number": business.gst_number if business else "",
        },
        "business_address": {
            "address1": business_address.address1,
            "address2": getattr(business_address, "address2", ""),
            "city": business_address.city,
            "state": business_address.state,
            "pin": business_address.pin,
            "country": business_address.country,
        } if business_address else None,
        "customer": customer_ctx,
        "quotation_number": quotation_number,
        "charges": {
            "subtotal": subtotal,
            "discount_total": discount_total,
            "tax_total": tax_total,
            "additional_charges_total": float(charges.get("additional_charges_total", 0) or 0),
            "round_off": float(charges.get("round_off", 0) or 0),
            "cgst": cgst,
            "cgst_rate": cgst_rate,
            "sgst": sgst,
            "sgst_rate": sgst_rate,
            "igst": igst,
            "igst_rate": igst_rate,
            "utgst": utgst,
            "utgst_rate": utgst_rate,
        },
        "notes": {
            "notes": notes.get("notes", ""),
            "terms_and_conditions": notes.get("terms_and_conditions", ""),
            "payment_terms": notes.get("payment_terms", ""),
        },
        "items": items,
    }

    return _render_pdf("pdf/invoice.html", context)


# ── Quotation PDF ────────────────────────────────────────────────────────────

def generate_quotation_pdf(quotation, items_data: list) -> BytesIO:
    """
    Generate a professional A4 PDF for a Quotation.

    Args:
        quotation: Quotation SQLAlchemy model instance (with relationships loaded).
        items_data: Pre-built list of dicts with item details.

    Returns:
        BytesIO buffer with the PDF content.
    """
    business = quotation.business
    customer = quotation.customer

    # Try to get the business address
    business_address = None
    if business and business.addresses:
        business_address = business.addresses[0]

    charges = quotation.charges or {}
    notes = quotation.additional_notes or {}

    # Build typed dicts for template safety
    items = []
    for item in items_data:
        raw_discount = item.get("discount") or {}
        discount_pct = raw_discount.get("discount_percentage", 0)
        if isinstance(discount_pct, dict):
            discount_pct = discount_pct.get("discount_percentage", 0)

        raw_tax = item.get("tax") or {}
        tax_pct = raw_tax.get("tax_percentage", 0)
        if isinstance(tax_pct, dict):
            tax_pct = tax_pct.get("tax_percentage", 0)
            
        fixed_discount = {
            "discount_percentage": discount_pct if discount_pct else 0,
            "discount_amount": raw_discount.get("discount_amount", 0)
        }
        
        fixed_tax = {
            "tax_percentage": tax_pct if tax_pct else 0,
            "tax_amount": raw_tax.get("tax_amount", 0)
        }

        qty = float(item.get("quantity", 0))
        if qty.is_integer():
            qty = int(qty)

        items.append({
            "product_name": item.get("product_name", ""),
            "description": item.get("description", ""),
            "image": item.get("image", ""),
            "hsn_sac_code": item.get("hsn_sac_code", ""),
            "quantity": qty,
            "unit_price": item.get("unit_price", 0),
            "discount": fixed_discount,
            "tax": fixed_tax,
            "total_price": item.get("total_price", 0),
        })

    tax_total = float(charges.get("tax_total", 0) or 0)
    subtotal = float(charges.get("subtotal", 0) or 0)
    discount_total = float(charges.get("discount_total", 0) or 0)
    taxable_amount = subtotal - discount_total

    cgst = float(charges.get("cgst", 0) or 0)
    cgst_rate = float(charges.get("cgst_rate", 0) or 0)
    sgst = float(charges.get("sgst", 0) or 0)
    sgst_rate = float(charges.get("sgst_rate", 0) or 0)
    igst = float(charges.get("igst", 0) or 0)
    igst_rate = float(charges.get("igst_rate", 0) or 0)
    utgst = float(charges.get("utgst", 0) or 0)
    utgst_rate = float(charges.get("utgst_rate", 0) or 0)

    # Auto-calculate breakdown if missing
    if tax_total > 0 and not any([cgst, sgst, igst, utgst]):
        total_rate = round((tax_total / taxable_amount) * 100, 2) if taxable_amount > 0 else 0
        half_rate = total_rate / 2.0
        half_tax = tax_total / 2.0
        
        b_state = (business_address.state or "").strip().lower() if business_address else ""
        
        cgst = half_tax
        cgst_rate = half_rate
        
        ut_keywords = ['andaman', 'chandigarh', 'dadra', 'daman', 'lakshadweep', 'delhi', 'puducherry', 'ladakh', 'jammu']
        is_ut = any(ut in b_state for ut in ut_keywords) if b_state else False
        
        if is_ut:
            utgst = half_tax
            utgst_rate = half_rate
        else:
            sgst = half_tax
            sgst_rate = half_rate

    # ── Resolve shipping address (from Shipping model, fallback to billing) ──
    ship = None
    if customer and hasattr(customer, 'default_shipping'):
        ship = customer.default_shipping

    customer_ctx = None
    if customer:
        customer_ctx = {
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "mobile": customer.mobile,
            "email": customer.email,
            "gst": customer.gst,
            # Billing address (flat columns on Customer)
            "address1": customer.address1,
            "address2": customer.address2,
            "city": customer.city,
            "state": customer.state,
            "country": customer.country,
            "pin": customer.pin,
            # Shipping address (from Shipping model, fallback to billing)
            "shipping_address1": (ship.address1 if ship else None) or customer.address1,
            "shipping_address2": None,  # Shipping model has no address2
            "shipping_city": (ship.city if ship else None) or customer.city,
            "shipping_state": (ship.state if ship else None) or customer.state,
            "shipping_country": (ship.country if ship else None) or customer.country,
            "shipping_pin": (ship.pin if ship else None) or customer.pin,
        }

    context = {
        "quotation": {
            "quotation_number": quotation.quotation_number,
            "quotation_date": quotation.quotation_date.strftime("%d %b %Y") if quotation.quotation_date else "—",
            "valid_till": quotation.valid_till.strftime("%d %b %Y") if quotation.valid_till else None,
            "total_amount": float(quotation.total_amount or 0),
            "amount_in_words": get_amount_in_words(float(quotation.total_amount or 0)),
            "status": quotation.status or "open",
        },
        "logo_data_uri": get_logo_data_uri(business.id if business else None),
        "esign_data_uri": get_esign_data_uri(business.id if business else None),
        "roboto_font_path": get_font_path(),
        "business": {
            "name": business.name if business else "",
            "phone_number": business.phone_number if business else "",
            "email": business.email if business else "",
            "gst_number": business.gst_number if business else "",
        },
        "business_address": {
            "address1": business_address.address1,
            "address2": getattr(business_address, "address2", ""),
            "city": business_address.city,
            "state": business_address.state,
            "pin": business_address.pin,
            "country": business_address.country,
        } if business_address else None,
        "customer": customer_ctx,
        "charges": {
            "subtotal": subtotal,
            "discount_total": discount_total,
            "tax_total": tax_total,
            "additional_charges_total": float(charges.get("additional_charges_total", 0) or 0),
            "round_off": float(charges.get("round_off", 0) or 0),
            "cgst": cgst,
            "cgst_rate": cgst_rate,
            "sgst": sgst,
            "sgst_rate": sgst_rate,
            "igst": igst,
            "igst_rate": igst_rate,
            "utgst": utgst,
            "utgst_rate": utgst_rate,
        },
        "notes": {
            "notes": notes.get("notes", ""),
            "terms_and_conditions": notes.get("terms_and_conditions", ""),
        },
        "items": items,
    }

    return _render_pdf("pdf/quotation.html", context)
