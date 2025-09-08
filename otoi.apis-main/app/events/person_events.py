from sqlalchemy import event, text
from app.models.person import Person
from app.models.customer import Customer
from app.models.common import Address
from app.models.person import PersonAddress
from app.extensions import db

PERSON_TYPE_MAP = {4: "4", 1: "1"}
STATUS_MAP = {4: "4", 5: "5"}


def _create_or_update_customer(connection, person: Person):
    """Create or update a Customer record from a Person if conditions match"""
    person_type_id = int(person.person_type_id) if str(person.person_type_id).isdigit() else person.person_type_id
    person_type_value = PERSON_TYPE_MAP.get(person_type_id)

    status = int(person.status) if str(person.status).isdigit() else person.status
    status_value = STATUS_MAP.get(status, str(status).lower())

    if person_type_value == "4" and status_value == "4":
        # Check if customer already exists for this person
        existing_customer = connection.execute(
            text("SELECT uuid FROM customers WHERE person_id = :person_id"),
            {"person_id": str(person.uuid)},
        ).fetchone()

        if existing_customer:
            # Update existing customer
            connection.execute(
                text("""
                    UPDATE customers SET
                        first_name = :first_name,
                        last_name = :last_name,
                        mobile = :mobile,
                        email = :email,
                        gst = :gst,
                        status = :status
                    WHERE person_id = :person_id
                """),
                {
                    "person_id": str(person.uuid),
                    "first_name": person.first_name,
                    "last_name": person.last_name,
                    "mobile": person.mobile,
                    "email": person.email,
                    "gst": person.gst,
                    "status": status_value,
                },
            )
        else:
            # Insert new customer
            import uuid
            customer_id = str(uuid.uuid4())
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
                    "person_id": str(person.uuid),
                    "first_name": person.first_name,
                    "last_name": person.last_name,
                    "mobile": person.mobile,
                    "email": person.email,
                    "gst": person.gst,
                    "status": status_value,
                },
            )


@event.listens_for(Person, "after_insert")
def create_customer_after_person_insert(mapper, connection, target):
    _create_or_update_customer(connection, target)


@event.listens_for(Person, "after_update")
def create_customer_after_person_update(mapper, connection, target):
    _create_or_update_customer(connection, target)


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
