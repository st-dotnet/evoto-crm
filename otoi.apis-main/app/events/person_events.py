from sqlalchemy import event, text
from app.models.person import Person
from app.models.customer import Customer
from app.models.common import Address
from app.models.person import PersonAddress
from app.extensions import db

PERSON_TYPE_MAP = {4: "lead", 1: "customer"}
STATUS_MAP = {4: "win", 5: "lost"}


@event.listens_for(Person, "after_insert")
def create_customer_after_person_insert(mapper, connection, target):
    """Automatically create a Customer record if Person is a Lead with status = Win"""
    person_type_id = int(target.person_type_id) if str(target.person_type_id).isdigit() else target.person_type_id
    person_type_value = PERSON_TYPE_MAP.get(person_type_id)

    status = int(target.status) if str(target.status).isdigit() else target.status
    status_value = STATUS_MAP.get(status, str(status).lower())

    if person_type_value == "lead" and status_value == "win":
        import uuid
        customer_id = str(uuid.uuid4())
        person_id = str(target.uuid)

        connection.execute(
            text("""
                INSERT INTO customers (
                    uuid, person_id, first_name, last_name, mobile, email, gst, status,
                    address1, address2, city, state, country, pin
                ) VALUES (
                    :customer_id, :person_id, :first_name, :last_name, :mobile, :email,
                    :gst, :status, '', '', '', '', '', ''
                )
            """),
            {
                "customer_id": customer_id,
                "person_id": person_id,
                "first_name": target.first_name,
                "last_name": target.last_name,
                "mobile": target.mobile,
                "email": target.email,
                "gst": target.gst,
                "status": status_value,
            },
        )


def _update_customer_with_address(connection, address, person_id):
    """Helper function to update customer with latest address"""
    customer_result = connection.execute(
        text("SELECT uuid FROM customers WHERE person_id = :person_id"),
        {"person_id": str(person_id)},
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
    """Keep customer address in sync with the latest Person address"""
    # Find persons linked to this address
    result = connection.execute(
        text("SELECT person_id FROM person_addresses WHERE address_id = :address_id"),
        {"address_id": str(target.uuid)},
    )

    for row in result:
        person_id = row[0]
        _update_customer_with_address(connection, target, person_id)


@event.listens_for(PersonAddress, "after_insert")
def update_customer_after_person_address_link(mapper, connection, target):
    """Update customer when a Person gets linked to an existing Address"""
    address_result = connection.execute(
        text("SELECT address1, address2, city, state, country, pin FROM addresses WHERE uuid = :address_id"),
        {"address_id": str(target.address_id)},
    ).fetchone()

    if address_result:
        class TmpAddress:
            address1, address2, city, state, country, pin = address_result
        _update_customer_with_address(connection, TmpAddress, target.person_id)
