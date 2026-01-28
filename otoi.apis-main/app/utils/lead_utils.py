from app.extensions import db
from app.models.customer import Customer
from app.models.person import Lead
import uuid

def sync_lead_to_customer(lead, address_data=None):
    """
    Synchronizes a lead with the Customer table if the status is 'Win'.
    """
    # Lead status 4 corresponds to "Win"
    status_str = str(lead.status).strip().lower()
    if status_str not in ["4", "win"]:
        return None

    # Find existing customer linked to this lead
    customer = Customer.query.filter_by(lead_id=lead.uuid).first()

    if not customer:
        customer = Customer(lead_id=lead.uuid)
        db.session.add(customer)

    # Update basic fields
    customer.first_name = lead.first_name
    customer.last_name = lead.last_name
    customer.mobile = lead.mobile
    customer.email = lead.email
    customer.gst = lead.gst
    
    # Use "1" for Active/Win in Customer if expected, 
    # but based on Lead mapping 4 is Win. 
    # The existing customer route uses string "1" as default.
    # Let's use "4" to match Lead status if they are shared, 
    # or "Win" if it's display name.
    # The Lead status mapping says 4 is "Win".
    customer.status = "4" # Storing as string "4" to be safe

    # Update address fields
    if address_data:
        customer.address1 = address_data.get("address1") or ""
        customer.address2 = address_data.get("address2")
        customer.city = address_data.get("city") or ""
        customer.state = address_data.get("state") or ""
        customer.country = address_data.get("country") or ""
        customer.pin = address_data.get("pin") or ""
    else:
        # If no address_data passed, try to fetch from lead's existing address
        # but only if we don't have better data.
        # For now, let's just ensure NOT NULL columns have something.
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

    return customer
