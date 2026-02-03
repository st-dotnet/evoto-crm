from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.extensions import db
import uuid
 
 
class CustomerQuery(db.Query):
    def get(self, ident):
        # First try to get the customer normally (excluding soft-deleted)
        rv = super().get(ident)
        if rv is None:
            # If not found, try including soft-deleted
            rv = self.with_deleted().filter(Customer.uuid == ident).first()
        return rv

    def __iter__(self):
        return iter(self.filter_by(is_deleted=False))

    def with_deleted(self):
        """Return a query that includes soft-deleted customers."""
        return self.filter(True if True else False)  # This will include all customers, even soft-deleted


class Customer(db.Model):
    __tablename__ = "customers"
    query_class = CustomerQuery
    __table_args__ = (
        UniqueConstraint('mobile', name='uq_customers_mobile'),
        UniqueConstraint('gst', name='uq_customers_gst'),
        UniqueConstraint('lead_id', name='uq_customers_lead_id')
    )
 
    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.uuid", ondelete="CASCADE"), nullable=False)
 
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    mobile = Column(String(15), nullable=True)
    email = Column(String(255), nullable=True)
    gst = Column(String(20), nullable=True)
    status = Column(String(80), nullable=False)
 
    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False)
    # Soft delete column
    is_deleted = Column(Boolean, default=False)
 
    # Relationships - exclude soft-deleted leads
    lead = relationship("Lead", back_populates="customers",
                       primaryjoin="and_(Customer.lead_id==Lead.uuid, Lead.is_deleted==False)")
    addresses = relationship("Address", back_populates="customer")
    shipping_addresses = relationship("Shipping", back_populates="customer", cascade="all, delete-orphan")

    @property
    def default_shipping(self):
        """Helper to get the default shipping address."""
        return next((addr for addr in self.shipping_addresses if addr.is_default), None)    