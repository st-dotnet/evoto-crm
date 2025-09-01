from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.common import BaseMixin, Address
import uuid


class Person(BaseMixin, db.Model):
    __tablename__ = "persons"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    person_type_id = Column(Integer, ForeignKey("person_types.id", ondelete="SET NULL"), nullable=True)
    mobile = Column(String(15), nullable=False, unique=True)
    email = Column(String(255), nullable=True)
    gst = Column(String(20), nullable=True)
    status = Column(String(80), nullable=False,)
    reason = Column(String(200), nullable=True)
    referenced_by = Column(String(500), nullable=True)
    
    # Relationships
    person_type = relationship("PersonType", back_populates="persons")
    addresses = relationship("PersonAddress", back_populates="person")
    customer = relationship("Customer", uselist=False, back_populates="person")  # one-to-one

class PersonAddress(BaseMixin,db.Model):
    __tablename__ = "person_addresses"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.uuid", ondelete="CASCADE"), nullable=False)
    address_id = Column(UUID(as_uuid=True), ForeignKey("addresses.uuid", ondelete="CASCADE"), nullable=False)

    # Relationships
    person = relationship("Person", back_populates="addresses")
    address = relationship("Address", back_populates="person_addresses")


class PersonType(BaseMixin, db.Model):
    __tablename__ = "person_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)

    # Relationships
    persons = relationship("Person", back_populates="person_type")

Person.person_type = relationship("PersonType", back_populates="persons")
Person.addresses = relationship("PersonAddress", back_populates="person")
Address.person_addresses = relationship("PersonAddress", back_populates="address",cascade="all, delete-orphan")