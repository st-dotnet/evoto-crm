from sqlalchemy import event
from app.models.person import Person, Customer, PersonAddress
from app.extensions import db
 
@event.listens_for(Person, "after_insert")
def create_customer_after_person_insert(mapper, connection, target):
    """Create a customer record if person is a lead and status = Win"""
    session = db.session.object_session(target)
 
    if target.person_type and target.person_type.name.lower() == "lead" and target.status.lower() == "win":
        # Map Person -> Customer
        customer = Customer(
            person=target,
            first_name=target.first_name,
            last_name=target.last_name,
            mobile=target.mobile,
            email=target.email,
            gst=target.gst,
            status=target.status,
            address1=target.addresses[0].address.address1 if target.addresses else "",
            address2=target.addresses[0].address.address2 if target.addresses else "",
            city=target.addresses[0].address.city if target.addresses else "",
            state=target.addresses[0].address.state if target.addresses else "",
            country=target.addresses[0].address.country if target.addresses else "",
            pin=target.addresses[0].address.pin if target.addresses else ""
        )
        session.add(customer)
        session.commit()    
 