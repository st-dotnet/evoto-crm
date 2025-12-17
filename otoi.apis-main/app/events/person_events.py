from sqlalchemy import event, text
from app.models.person import Lead, LeadAddress
from app.models.customer import Customer
from app.models.common import Address
from app.extensions import db

STATUS_MAP = {4: "win", 5: "lose"}


@event.listens_for(Lead, "after_insert")
def create_customer_after_lead_insert(mapper, connection, target):
    """Automatically create a Customer record if Lead status = Win"""
    status = int(target.status) if str(target.status).isdigit() else target.status
    status_value = STATUS_MAP.get(status, str(status).lower())

    if status_value == "4":
        import uuid
        customer_id = str(uuid.uuid4())
        lead_id = str(target.uuid)

        connection.execute(
            text("""
                INSERT INTO customers (
                    uuid, lead_id, first_name, last_name, mobile, email, gst, status,
                    address1, address2, city, state, country, pin
                ) VALUES (
                    :customer_id, :lead_id, :first_name, :last_name, :mobile, :email,
                    :gst, :status, '', '', '', '', '', ''
                )
            """),
            {
                "customer_id": customer_id,
                "lead_id": lead_id,
                "first_name": target.first_name,
                "last_name": target.last_name,
                "mobile": target.mobile,
                "email": target.email,
                "gst": target.gst,
                "status": status_value,
            },
        )


def _update_customer_with_address(connection, address, lead_id):
    """Helper function to update customer with latest address"""
    customer_result = connection.execute(
        text("SELECT uuid FROM customers WHERE lead_id = :lead_id"),
        {"lead_id": str(lead_id)},
    ).fetchone()

    if customer_result:
        customer_id = str(customer_result[0])
        connection.execute(
            text("""
                UPDATE customers SET
                    address1 = :address1,
                    address2 = :address2,
                    city = :city,
                    state = :state,
                    country = :country,
                    pin = :pin
                WHERE uuid = :customer_id
            """),
            {
                "address1": address.address1,
                "address2": address.address2,
                "city": address.city,
                "state": address.state,
                "country": address.country,
                "pin": address.pin,
                "customer_id": customer_id,
            },
        )


@event.listens_for(Address, "after_insert")
@event.listens_for(Address, "after_update")
def update_customer_after_address(mapper, connection, target):
    """Keep customer address in sync with the latest Lead address"""
    # Find leads linked to this address
    result = connection.execute(
        text("SELECT lead_id FROM lead_addresses WHERE address_id = :address_id"),
        {"address_id": str(target.uuid)},
    )

    for row in result:
        lead_id = row[0]
        _update_customer_with_address(connection, target, lead_id)


@event.listens_for(LeadAddress, "after_insert")
def update_customer_after_lead_address_link(mapper, connection, target):
    """Update customer when a Lead gets linked to an existing Address"""
    address_result = connection.execute(
        text("SELECT address1, address2, city, state, country, pin FROM addresses WHERE uuid = :address_id"),
        {"address_id": str(target.address_id)},
    ).fetchone()

    if address_result:
        class TmpAddress:
            address1, address2, city, state, country, pin = address_result
        _update_customer_with_address(connection, TmpAddress, target.lead_id)

