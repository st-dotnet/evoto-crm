from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class PaymentIn(BaseMixin, db.Model):
    __tablename__ = "payment_ins"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Payment Number (e.g. PAY-1001)
    payment_number = Column(String(50), unique=True, nullable=False)
    
    # Payment Date
    payment_date = Column(Date, nullable=False)
    
    # Link to invoice
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.uuid", ondelete="CASCADE"), nullable=False)
    
    # Party/Customer info (redundant but for quick access)
    party_name = Column(String(200), nullable=False)
    
    # Invoice Number (for reference)
    invoice_number = Column(String(50), nullable=False)
    
    # Financial amounts - only fully paid invoices allowed
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_received = Column(Numeric(12, 2), nullable=False)
    balance_due = Column(Numeric(12, 2), default=0)  # Should always be 0 for fully paid
    discount = Column(Numeric(12, 2), default=0)
    
    # Payment details - only paid payments allowed
    payment_status = Column(String(20), default="paid", nullable=False)  # Only "paid" status allowed
    payment_mode = Column(String(50), nullable=False) 
    
    # Additional notes
    payment_notes = Column(Text, nullable=True)
    
    # Business context
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    
    # User who recorded the payment
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.uuid"), nullable=True)
    
    # User who last updated the payment
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.uuid"), nullable=True)

    # Relationships
    invoice = relationship("Invoice", backref="payments")
    business = relationship("Business")
    user = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<PaymentIn {self.payment_number} | ₹{self.amount_received} | {self.payment_mode}>"

    @property
    def is_fully_paid(self):
        """Check if payment fully covers the invoice"""
        return self.balance_due <= 0

    @property
    def payment_percentage(self):
        """Calculate what percentage of total amount is paid"""
        if self.total_amount == 0:
            return 0
        return float((self.amount_received / self.total_amount) * 100)