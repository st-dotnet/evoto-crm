"""
PDF Generation Service
────────────────────
Uses xhtml2pdf (pisa) to render Jinja2 HTML templates into downloadable A4 PDFs.
Supports: Invoice, Quotation, Inventory (easily extensible to other document types).
"""

from io import BytesIO
from flask import render_template, current_app
from xhtml2pdf import pisa
import os
import base64
import math
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.units import mm
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
    Supports robust fallbacks for local and incomplete environments.
    """
    # 1. Primary: Try specified business_id
    config = GlobalConfig.query.filter_by(business_id=business_id, key=key).first()
    
    # 2. Secondary: Fallback to ANY record for this key (useful for local dev with 1 business)
    if not config and business_id:
        config = GlobalConfig.query.filter_by(key=key).first()
        
    asset_path = None
    if config and config.value:
        asset_path = os.path.join(Config.BUSINESS_ASSETS_FOLDER, config.value)
        
    # 3. Tertiary: Try common filename patterns if still missing (last resort for local setup)
    if not asset_path or not os.path.exists(asset_path):
        # Common filenames like e_sign_1.png, site_logo_1.png or e_sign.png
        possible_names = [f"{key}_{business_id}.png", f"{key}_1.png", f"{key}.png", f"{key}.jpg", f"{key}.jpeg"]
        for fname in possible_names:
            p = os.path.join(Config.BUSINESS_ASSETS_FOLDER, fname)
            if os.path.exists(p):
                asset_path = p
                break

    if asset_path and os.path.exists(asset_path):
        try:
            with Image.open(asset_path) as img:
                # Determine format based on extension
                ext = os.path.splitext(asset_path)[1].lower()
                mime = "image/png" if ext == ".png" else "image/jpeg"
                
                # If transparent PNG, might need conversion for some PDF engines
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGBA")
                    background = Image.new("RGBA", img.size, (255, 255, 255))
                    background.paste(img, mask=img)
                    img = background.convert("RGB")
                    mime = "image/jpeg"
                
                buffer = BytesIO()
                if mime == "image/jpeg":
                    img.save(buffer, format="JPEG", quality=95)
                else:
                    img.save(buffer, format="PNG")
                    
                encoded_string = base64.b64encode(buffer.getvalue()).decode("utf-8")
                return f"data:{mime};base64,{encoded_string}"
        except Exception as e:
            # Fallback: raw read if PIL fails
            try:
                with open(asset_path, "rb") as f:
                    data = f.read()
                    encoded_string = base64.b64encode(data).decode("utf-8")
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

def get_item_image_data_uri(item_id, image_name):
    """
    Fetch an item image, decode the file, and return as a base64 data URI.
    """
    image_path = os.path.join(Config.ITEM_IMAGES_FOLDER, str(item_id), image_name)
    
    if os.path.exists(image_path):
        try:
            with open(image_path, "rb") as f:
                data = f.read()
                encoded_string = base64.b64encode(data).decode("utf-8")
                ext = os.path.splitext(image_path)[1].lower()
                mime = "image/png" if ext == ".png" else "image/jpeg"
                return f"data:{mime};base64,{encoded_string}"
        except:
            pass
    return None

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
    # xhtml2pdf (pisa) requires a bytes-like object, not str.
    # Encode the rendered HTML to UTF-8 bytes before handing it to pisa.
    html_bytes = html_string.encode("utf-8")
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_bytes, dest=buffer)

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
        
        if is_ut == True:
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


# ── Purchase Invoice PDF ──────────────────────────────────────────────────────

def generate_purchase_invoice_pdf(invoice, items_data: list) -> BytesIO:
    """
    Generate a professional A4 PDF for a Purchase Invoice.

    Args:
        invoice: PurchaseInvoice SQLAlchemy model instance (with relationships loaded).
        items_data: Pre-built list of dicts with item details (product_name, hsn, etc).

    Returns:
        BytesIO buffer with the PDF content.
    """
    business = getattr(invoice, 'business', None)
    vendor = getattr(invoice, 'vendor', None)

    # Try to get the business address
    business_address = None
    if business and hasattr(business, 'addresses') and business.addresses:
        business_address = business.addresses[0]

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
            "measuring_unit_id": item.get("measuring_unit_id")
        })

    # Calculate tax totals from items if not in charges
    tax_total = float(charges.get("tax_total", 0) or 0)
    subtotal = float(charges.get("subtotal", 0) or 0)
    discount_total = float(charges.get("discount_total", 0) or 0)

    # If charges are empty, compute from items
    if subtotal == 0 and items:
        subtotal = sum(
            float(item.get("unit_price", 0)) * float(item.get("quantity", 0))
            for item in items_data
        )
    if discount_total == 0 and items:
        discount_total = sum(
            float(item.get("unit_price", 0)) * float(item.get("quantity", 0)) * float((item.get("discount") or {}).get("discount_percentage", 0) or 0) / 100
            for item in items_data
        )
    if tax_total == 0 and items:
        tax_total = sum(
            (float(item.get("unit_price", 0)) * float(item.get("quantity", 0)) - float(item.get("unit_price", 0)) * float(item.get("quantity", 0)) * float((item.get("discount") or {}).get("discount_percentage", 0) or 0) / 100) * float((item.get("tax") or {}).get("tax_percentage", 0) or 0) / 100
            for item in items_data
        )

    taxable_amount = subtotal - discount_total

    cgst = float(charges.get("cgst", 0) or 0)
    cgst_rate = float(charges.get("cgst_rate", 0) or 0)
    sgst = float(charges.get("sgst", 0) or 0)
    sgst_rate = float(charges.get("sgst_rate", 0) or 0)

    # Auto-calculate breakdown if missing
    if tax_total > 0 and not any([cgst, sgst]):
        total_rate = round((tax_total / taxable_amount) * 100, 2) if taxable_amount > 0 else 0
        half_rate = total_rate / 2.0
        half_tax = tax_total / 2.0
        cgst = half_tax
        cgst_rate = half_rate
        sgst = half_tax
        sgst_rate = half_rate

    vendor_ctx = None
    if vendor:
        vendor_ctx = {
            "vendor_name": vendor.vendor_name,
            "company_name": vendor.company_name,
            "mobile": vendor.mobile,
            "email": vendor.email,
            "gst": vendor.gst,
            "address1": vendor.address1,
            "city": vendor.city,
            "state": vendor.state,
            "country": vendor.country,
            "pin": vendor.pin,
        }

    context = {
        "invoice": {
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date.strftime("%d %b %Y") if invoice.invoice_date else "—",
            "due_date": invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "—",
            "total_amount": float(invoice.total_amount or 0),
            "amount_in_words": get_amount_in_words(float(invoice.total_amount or 0)),
            "amount_paid": float(invoice.amount_paid or 0),
            "balance_due": float(invoice.balance_due or 0),
            "payment_status": invoice.payment_status or "unpaid",
        },
        "logo_data_uri": get_logo_data_uri(getattr(business, 'id', None)),
        "esign_data_uri": get_esign_data_uri(getattr(business, 'id', None)),
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
        "vendor": vendor_ctx,
        "charges": {
            "subtotal": subtotal,
            "discount_total": discount_total,
            "tax_total": tax_total,
            "cgst": cgst,
            "cgst_rate": cgst_rate,
            "sgst": sgst,
            "sgst_rate": sgst_rate,
        },
        "notes": {
            "notes": notes.get("notes", ""),
            "terms_and_conditions": notes.get("terms_and_conditions", ""),
        },
        "items": items,
    }

    return _render_pdf("pdf/purchase_invoice.html", context)


# ── Purchase Order PDF ────────────────────────────────────────────────────────

def generate_purchase_order_pdf(po, items_data: list) -> BytesIO:
    """
    Generate a professional A4 PDF for a Purchase Order.

    Args:
        po: PurchaseOrder SQLAlchemy model instance (with relationships loaded).
        items_data: Pre-built list of dicts with item details.

    Returns:
        BytesIO buffer with the PDF content.
    """
    business = getattr(po, 'business', None)
    vendor   = getattr(po, 'vendor', None)

    # Try to get the business address
    business_address = None
    if business and hasattr(business, 'addresses') and business.addresses:
        business_address = business.addresses[0]

    notes = po.additional_notes or {}
    charges = po.charges or {}

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
            "description":  item.get("description", ""),
            "image":        item.get("image", ""),
            "hsn_sac_code": item.get("hsn_sac_code", ""),
            "quantity":     qty,
            "unit_price":   item.get("unit_price", 0),
            "discount":     fixed_discount,
            "tax":          fixed_tax,
            "total_price":  item.get("total_price", 0),
            "measuring_unit_id": item.get("measuring_unit_id")
        })

    # Totals — prefer charges JSON, fall back to per-item calculation
    subtotal       = float(charges.get("subtotal", 0) or 0)
    discount_total = float(charges.get("discount_total", 0) or 0)
    tax_total      = float(charges.get("tax_total", 0) or 0)

    if subtotal == 0 and items:
        subtotal = sum(float(i.get("unit_price", 0)) * float(i.get("quantity", 0)) for i in items_data)
    if discount_total == 0 and items:
        discount_total = sum(
            float(i.get("unit_price", 0)) * float(i.get("quantity", 0)) *
            float((i.get("discount") or {}).get("discount_percentage", 0) or 0) / 100
            for i in items_data
        )
    if tax_total == 0 and items:
        tax_total = sum(
            (float(i.get("unit_price", 0)) * float(i.get("quantity", 0)) -
             float(i.get("unit_price", 0)) * float(i.get("quantity", 0)) *
             float((i.get("discount") or {}).get("discount_percentage", 0) or 0) / 100) *
            float((i.get("tax") or {}).get("tax_percentage", 0) or 0) / 100
            for i in items_data
        )

    taxable_amount = subtotal - discount_total
    cgst = float(charges.get("cgst", 0) or 0)
    cgst_rate = float(charges.get("cgst_rate", 0) or 0)
    sgst = float(charges.get("sgst", 0) or 0)
    sgst_rate = float(charges.get("sgst_rate", 0) or 0)

    if tax_total > 0 and not any([cgst, sgst]):
        total_rate = round((tax_total / taxable_amount) * 100, 2) if taxable_amount > 0 else 0
        half_rate = total_rate / 2.0
        half_tax  = tax_total / 2.0
        cgst = half_tax
        cgst_rate = half_rate
        sgst = half_tax
        sgst_rate = half_rate

    vendor_ctx = None
    if vendor:
        vendor_ctx = {
            "vendor_name":  vendor.vendor_name,
            "company_name": vendor.company_name,
            "mobile":       vendor.mobile,
            "email":        vendor.email,
            "gst":          vendor.gst,
            "address1":     vendor.address1,
            "city":         vendor.city,
            "state":        vendor.state,
            "country":      vendor.country,
            "pin":          vendor.pin,
        }

    context = {
        "po": {
            "po_number":      po.po_number,
            "po_date":        po.po_date.strftime("%d %b %Y") if po.po_date else "—",
            "delivery_date":  po.delivery_date.strftime("%d %b %Y") if po.delivery_date else "—",
            "total_amount":   float(po.total_amount or 0),
            "amount_in_words": get_amount_in_words(float(po.total_amount or 0)),
            "status":         po.status or "open",
        },
        "logo_data_uri":   get_logo_data_uri(getattr(business, 'id', None)),
        "esign_data_uri":  get_esign_data_uri(getattr(business, 'id', None)),
        "roboto_font_path": get_font_path(),
        "business": {
            "name":         business.name if business else "",
            "phone_number": business.phone_number if business else "",
            "email":        business.email if business else "",
            "gst_number":   business.gst_number if business else "",
        },
        "business_address": {
            "address1": business_address.address1,
            "address2": getattr(business_address, "address2", ""),
            "city":     business_address.city,
            "state":    business_address.state,
            "pin":      business_address.pin,
            "country":  business_address.country,
        } if business_address else None,
        "vendor": vendor_ctx,
        "charges": {
            "subtotal":        subtotal,
            "discount_total":  discount_total,
            "tax_total":       tax_total,
            "cgst":            cgst,
            "cgst_rate":       cgst_rate,
            "sgst":            sgst,
            "sgst_rate":       sgst_rate,
        },
        "notes": {
            "notes":                notes.get("notes", ""),
            "terms_and_conditions": notes.get("terms_and_conditions", ""),
        },
        "items": items,
    }

    return _render_pdf("pdf/purchase_order.html", context)


# ── Inventory PDF ──────────────────────────────────────────────────────

def generate_inventory_pdf(search: str = '') -> dict:
    """
    Generate PDF for inventory rate list using reportlab for better table formatting.
    
    Args:
        search: Optional search term to filter items
        
    Returns:
        Dictionary with success status, PDF data, and metadata
    """
    try:
        # Import models for direct database access
        from ..models import Item
        from ..extensions import db
        from sqlalchemy import or_
        
        # Build base query - same as Excel export
        query = db.session.query(
            Item.item_name,
            Item.item_code,
            Item.purchase_price,
            Item.sales_price
        ).filter(Item.is_deleted == False)
        
        # Apply search filter
        if search:
            query = query.filter(
                or_(
                    Item.item_name.ilike(f"%{search}%"),
                    Item.item_code.ilike(f"%{search}%")
                )
            )
        
        # Get results
        items = query.all()
        
        # Convert to dict format for PDF generation
        items_data = []
        for item in items:
            items_data.append({
                'item_name': item.item_name or '',
                'item_code': item.item_code or '',
                'purchase_price': float(item.purchase_price) if item.purchase_price else 0.0,
                'sales_price': float(item.sales_price) if item.sales_price else 0.0
            })
        
        # Create PDF buffer with landscape orientation
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=landscape(A4), 
            rightMargin=20*mm, 
            leftMargin=20*mm, 
            topMargin=30*mm, 
            bottomMargin=20*mm
        )
        
        # Define styles
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        normal_style = styles['Normal']
        
        # Custom styles for better appearance
        title_style.fontSize = 18
        title_style.textColor = colors.HexColor('#2C3E50')
        title_style.spaceAfter = 20
        
        normal_style.fontSize = 10
        normal_style.textColor = colors.HexColor('#34495E')
        normal_style.spaceAfter = 6
        
        # Build document
        elements = []
        
        # Title
        elements.append(Paragraph("Inventory Rate List - Print Version", title_style))
        elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y')}", normal_style))
        
        if search:
            elements.append(Paragraph(f"Search: {search}", normal_style))
            elements.append(Paragraph("<br/>", normal_style))
        
        # Table headers
        table_data = [['Item Name', 'Item Code', 'MRP (Rs.)', 'Selling Price (Rs.)']]
        
        # Add table data with proper text wrapping
        for item in items_data:
            table_data.append([
                item.get('item_name', ''),  # Full item name - let it wrap
                item.get('item_code', ''),  # Full item code - let it wrap
                f"Rs.{item.get('purchase_price', 0):.2f}" if item.get('purchase_price') else 'Rs.0.00',
                f"Rs.{item.get('sales_price', 0):.2f}" if item.get('sales_price') else 'Rs.0.00'
            ])
        
        # Create table with proper column widths for long item names
        col_widths = [
            80*mm,   # Item Name - much wider for long names
            35*mm,   # Item Code - medium
            25*mm,   # MRP - smaller
            25*mm    # Selling Price - smaller
        ]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)  # Repeat header on each page
        
        # Apply table styling with better spacing
        table.setStyle(TableStyle([
            # Header row styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#000000')),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            
            # Data row styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (-1, -1), 'LEFT'),  # Item Name - Left align
            ('ALIGN', (1, 1), (-1, -1), 'LEFT'),  # Item Code - Left align  
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'), # MRP - Right align
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'), # Selling Price - Right align
            
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8F9FA')]),
            
            # Grid lines
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DEE2E6')),
            
            # Cell padding - increased to prevent overlapping
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            
            # Text wrapping
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        elements.append(table)
        
        # Add summary
        elements.append(Paragraph(f"<br/><br/>Total Items: {len(items_data)}", normal_style))
        
        # Build PDF
        doc.build(elements)
        
        # Get buffer value without closing
        buffer.seek(0)
        pdf_value = buffer.getvalue()
        
        return {
            'success': True,
            'data': pdf_value,
            'metadata': {
                'item_count': len(items_data),
                'search': search,
                'generated_at': datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"PDF generation failed: {str(e)}"
        }


def generate_print_inventory_pdf(search: str = '', print_options: dict = None) -> dict:
    """
    Generate print-optimized PDF for inventory rate list.
    
    Args:
        search: Optional search term to filter items
        print_options: Dictionary with print settings (copies, paper_size, orientation, quality)
        
    Returns:
        Dictionary with success status, PDF data, and metadata
    """
    try:
        # Import models for direct database access
        from ..models import Item
        from ..extensions import db
        from sqlalchemy import or_
        from reportlab.lib.pagesizes import A4, portrait, landscape
        
        # Get print options with defaults
        if not print_options:
            print_options = {}
        
        copies = print_options.get('copies', 1)
        paper_size = print_options.get('paper_size', 'A4')
        orientation = print_options.get('orientation', 'portrait')
        quality = print_options.get('quality', 'high')
        
        # Build base query
        query = db.session.query(
            Item.item_name,
            Item.item_code,
            Item.purchase_price,
            Item.sales_price
        ).filter(Item.is_deleted == False)
        
        # Apply search filter
        if search:
            query = query.filter(
                or_(
                    Item.item_name.ilike(f"%{search}%"),
                    Item.item_code.ilike(f"%{search}%")
                )
            )
        
        # Get results
        items = query.all()
        
        # Convert to dict format
        items_data = []
        for item in items:
            items_data.append({
                'item_name': item.item_name or '',
                'item_code': item.item_code or '',
                'purchase_price': float(item.purchase_price) if item.purchase_price else 0.0,
                'sales_price': float(item.sales_price) if item.sales_price else 0.0
            })
        
        # Set page size based on options
        if paper_size == 'A4':
            if orientation == 'portrait':
                page_size = A4
            else:
                page_size = landscape(A4)
        elif paper_size == 'A3':
            # Try to import A3, fallback to A4 landscape if not available
            try:
                from reportlab.lib.pagesizes import A3
                if orientation == 'portrait':
                    page_size = A3
                else:
                    page_size = landscape(A3)
            except ImportError:
                # A3 not available, fallback to A4 landscape
                page_size = landscape(A4)
        else:  # Letter
            page_size = A4  # Fallback to A4
        
        # Create PDF buffer with print-optimized settings
        buffer = BytesIO()
        
        # Ensure mm is defined for ReportLab
        try:
            from reportlab.lib.units import mm
        except ImportError:
            # If mm not available, define it manually
            mm = 1.0  # This will be used as a multiplier
        
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=page_size, 
            rightMargin=15*mm if orientation == 'portrait' else 20*mm, 
            leftMargin=15*mm if orientation == 'portrait' else 20*mm, 
            topMargin=25*mm, 
            bottomMargin=15*mm
        )
        
        # Define styles optimized for printing
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        normal_style = styles['Normal']
        
        # Print-optimized styles
        title_style.fontSize = 16 if orientation == 'portrait' else 14
        title_style.textColor = colors.black
        title_style.spaceAfter = 15
        
        normal_style.fontSize = 9 if quality == 'high' else 8
        normal_style.textColor = colors.black
        normal_style.spaceAfter = 4
        
        # Build document
        elements = []
        
        # Print header
        elements.append(Paragraph("INVENTORY RATE LIST - PRINT COPY", title_style))
        elements.append(Paragraph(f"Printed on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", normal_style))
        
        if search:
            elements.append(Paragraph(f"Search Filter: {search}", normal_style))
            elements.append(Paragraph("<br/>", normal_style))
        
        # Print options info
        elements.append(Paragraph(f"Print Settings: {paper_size} {orientation}, Quality: {quality}, Copies: {copies}", normal_style))
        elements.append(Paragraph("<br/>", normal_style))
        
        # Table headers
        table_data = [['Item Name', 'Item Code', 'MRP (Rs.)', 'Selling Price (Rs.)']]
        
        # Add table data
        for item in items_data:
            table_data.append([
                item.get('item_name', ''),
                item.get('item_code', ''),
                f"Rs.{item.get('purchase_price', 0):.2f}" if item.get('purchase_price') else 'Rs.0.00',
                f"Rs.{item.get('sales_price', 0):.2f}" if item.get('sales_price') else 'Rs.0.00'
            ])
        
        # Column widths optimized for print
        if orientation == 'portrait':
            col_widths = [70*mm, 30*mm, 25*mm, 25*mm]
        else:
            col_widths = [80*mm, 35*mm, 25*mm, 25*mm]
            
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Print-optimized table styling
        table.setStyle(TableStyle([
            # Header row styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7 if quality == 'high' else 6),
            
            # Data row styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8 if quality == 'high' else 7),
            ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            
            # Print-friendly alternating colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9F9F9')]),
            
            # Print-optimized grid
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#666666')),
            
            # Print-optimized padding
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        elements.append(table)
        
        # Print footer
        elements.append(Paragraph(f"<br/><br/>Total Items: {len(items_data)}", normal_style))
        elements.append(Paragraph(f"Page 1 of 1", normal_style))
        
        # Build PDF
        doc.build(elements)
        
        # Get buffer value
        buffer.seek(0)
        pdf_value = buffer.getvalue()
        
        return {
            'success': True,
            'data': pdf_value,
            'metadata': {
                'item_count': len(items_data),
                'search': search,
                'print_options': print_options,
                'generated_at': datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return {
            'success': False,
            'error': f"Print PDF generation failed: {str(e)}",
            'error_details': error_details,
            'traceback': traceback.format_exc()
        }
