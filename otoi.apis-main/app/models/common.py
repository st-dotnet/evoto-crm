import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db

class BaseMixin:
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.uuid", ondelete="SET NULL"),
        nullable=True
    )
    updated_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.uuid", ondelete="SET NULL"),
        nullable=True
    )
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Address(BaseMixin, db.Model):
    __tablename__ = "addresses"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False)
    business_id = Column(
        Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True
    )
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.uuid", ondelete="CASCADE"),
        nullable=True,
    )

    lead_addresses = relationship(
        "LeadAddress", back_populates="address", cascade="all, delete-orphan"
    )
    leads = relationship(
        "Lead",
        secondary="lead_addresses",
        back_populates="addresses",
        overlaps="lead_addresses",
    )
    shippings = relationship(
        "Shipping", foreign_keys="[Shipping.address_id]", back_populates="address"
    )

    customer = relationship("Customer", back_populates="addresses")
    business = relationship("Business", back_populates="addresses")

    # Direct many-to-many with Lead (through lead_addresses)
    leads = relationship("Lead", secondary="lead_addresses", back_populates="addresses")

    def __repr__(self):
        return (
            f"<Address(address1={self.address1}, city={self.city}, state={self.state}, "
            f"country={self.country}, pin={self.pin})>"
        )


class Shipping(BaseMixin, db.Model):
    __tablename__ = "shippings"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address_id = Column(UUID(as_uuid=True), ForeignKey("addresses.uuid", ondelete="CASCADE"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.uuid", ondelete="CASCADE"), nullable=True)
    is_default = Column(Boolean, server_default='false', nullable=True)

    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False) 
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)

    # Relationships
    address = relationship("Address", back_populates="shippings")
    customer = relationship("Customer", back_populates="shipping_addresses")
    lead_addresses = relationship(
        "LeadAddress", 
        foreign_keys="LeadAddress.shipping_id",
        back_populates="shipping"
    )

    def __repr__(self):
        return (
            f"<Shipping(address1={self.address1}, city={self.city}, state={self.state}, "
            f"country={self.country}, pin={self.pin})>"
        )
