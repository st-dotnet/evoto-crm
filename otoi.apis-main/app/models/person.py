from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.common import BaseMixin, Address

class Person(BaseMixin, db.Model):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    person_type_id = Column(Integer, ForeignKey("person_types.id", ondelete="SET NULL"), nullable=True)
    mobile = Column(String(15), nullable=False, unique=True)
    email = Column(String(255), nullable=True)
    # test = Column(String(255), nullable= True)
    gst = Column(String(20), nullable=True)
    referenced_by = Column(String(500), nullable=True)
    
    # Relationships
    person_type = relationship("PersonType", back_populates="persons")
    addresses = relationship("PersonAddress", back_populates="person")


class PersonAddress(BaseMixin,db.Model):
    __tablename__ = "person_addresses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    address_id = Column(Integer, ForeignKey("addresses.id", ondelete="CASCADE"), nullable=False)

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
Address.person_addresses = relationship("PersonAddress", back_populates="address")