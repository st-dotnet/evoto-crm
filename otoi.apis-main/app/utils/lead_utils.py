from app.extensions import db
from app.models.customer import Customer
from app.models.person import Lead
from sqlalchemy import func
import uuid

def sync_lead_to_customer(lead, address_data=None):
    """
    Synchronizes a lead with the Customer table if the status is 'Win'.
    """
    # Lead status 4 corresponds to "Win"
    status_str = str(lead.status).strip().lower()
    if status_str not in ["4", "win"]:
        return None, False

    matched_existing_customer = False
    created_new_customer = False

    # 1) Find existing customer linked to this lead
    customer = Customer.query.filter_by(lead_id=lead.uuid).first()

    # 2) If no customer for this lead, try to find an existing customer by GST or mobile
    if not customer:
        gst = (lead.gst or "").strip()
        mobile = (lead.mobile or "").strip()

        if gst:
            gst_upper = gst.upper()
            customer = Customer.query.filter(func.upper(Customer.gst) == gst_upper).first()
            if customer:
                matched_existing_customer = True

        if not customer and mobile:
            customer = Customer.query.filter(Customer.mobile == mobile).first()
            if customer:
                matched_existing_customer = True

    if not customer:
        customer = Customer(lead_id=lead.uuid)
        db.session.add(customer)
        created_new_customer = True
    elif matched_existing_customer:
        customer.lead_id = lead.uuid

    # Update basic fields.
    # If we matched an existing customer by GST/mobile, prefer NOT to overwrite existing
    # customer details; only fill missing values.
    if created_new_customer or not matched_existing_customer:
        customer.first_name = lead.first_name
        customer.last_name = lead.last_name
        customer.email = lead.email
        customer.mobile = lead.mobile
        customer.gst = lead.gst
    else:
        if not customer.email:
            customer.email = lead.email
        if not customer.mobile:
            customer.mobile = lead.mobile
        if not customer.gst:
            customer.gst = lead.gst
    
    # Use "1" for Active/Win in Customer if expected, 
    # but based on Lead mapping 4 is Win. 
    # The existing customer route uses string "1" as default.
    # Let's use "4" to match Lead status if they are shared, 
    # or "Win" if it's display name.
    # The Lead status mapping says 4 is "Win".
    customer.status = "4" # Storing as string "4" to be safe

    # Update address fields.
    # For matched existing customer, don't overwrite address; only fill missing required fields.
    if address_data and (created_new_customer or not matched_existing_customer):
        customer.address1 = address_data.get("address1") or ""
        customer.address2 = address_data.get("address2")
        customer.city = address_data.get("city") or ""
        customer.state = address_data.get("state") or ""
        customer.country = address_data.get("country") or ""
        customer.pin = address_data.get("pin") or ""
    else:
        # Ensure NOT NULL columns have something.
        if not customer.address1:
            customer.address1 = ""
        if not customer.city:
            customer.city = ""
        if not customer.state:
            customer.state = ""
        if not customer.country:
            customer.country = ""
        if not customer.pin:
            customer.pin = ""

    return customer, matched_existing_customer
