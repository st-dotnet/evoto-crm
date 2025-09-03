from sqlalchemy import Column, Integer, ForeignKey, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from sqlalchemy.orm import relationship
from app.extensions import db
import uuid

class BaseMixin:
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

class Address(BaseMixin, db.Model):
    __tablename__ = "addresses"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    address1 = Column(String(255), nullable=True)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False)  # Postal Code
    
    # Make business_id nullable to resolve circular dependency
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)
   
 
    # Relationships
    person_addresses = relationship("PersonAddress", back_populates="address",cascade="all, delete-orphan")
    business = relationship("Business", back_populates="addresses")

    # Direct many-to-many with Person (through person_addresses)
    persons = relationship("Person",secondary="person_addresses",back_populates="addresses")


    def __repr__(self):
        return (f"<Address(address1={self.address1}, city={self.city}, state={self.state}, "
                f"country={self.country}, pin={self.pin})>")