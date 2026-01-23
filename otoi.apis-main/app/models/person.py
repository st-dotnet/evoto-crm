from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.common import BaseMixin
import uuid


class Lead(BaseMixin, db.Model):
    __tablename__ = "leads"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    mobile = Column(String(15), nullable=True)
    email = Column(String(255), nullable=True)
    gst = Column(String(20), nullable=True)
    status = Column(Integer, nullable=False)
    reason = Column(String(200), nullable=True)
     # Add this column if needed
    referenced_by = db.Column(db.String(120))


    # Relationships
    lead_addresses = relationship("LeadAddress", back_populates="lead", cascade="all, delete-orphan", overlaps="leads")

    # direct access to addresses
    addresses = relationship("Address", secondary="lead_addresses", back_populates="leads", overlaps="lead_addresses")

    # one-to-one relation with Customer
    customers = relationship("Customer", back_populates="lead", cascade="all, delete-orphan")


    def __repr__(self):
        return f"<Lead(name={self.first_name} {self.last_name}, mobile={self.mobile})>"


# -------------------------
# LeadAddress (join table)
# -------------------------
class LeadAddress(BaseMixin, db.Model):
    __tablename__ = "lead_addresses"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.uuid", ondelete="CASCADE"), nullable=False)
    address_id = Column(UUID(as_uuid=True), ForeignKey("addresses.uuid", ondelete="CASCADE"), nullable=False)
    # shipping_id = Column(UUID(as_uuid=True), ForeignKey("shippings.uuid", ondelete="CASCADE"), nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="lead_addresses", overlaps="addresses,leads")
    address = relationship("Address", back_populates="lead_addresses", overlaps="addresses,leads")
    # shipping = relationship("Shipping", back_populates="lead_addresses")

    def __repr__(self):
        return f"<LeadAddress(lead_id={self.lead_id}, address_id={self.address_id})>"


