from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class PaymentOut(BaseMixin, db.Model):
    """
    Records an outgoing payment made to a vendor against a Purchase Invoice.
    Mirrors PaymentIn but is linked to purchase_invoices instead of invoices.
    """
    __tablename__ = "payment_outs"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Payment Number (e.g. POUT-1001)
    payment_number = Column(String(50), unique=True, nullable=False)

    # Payment Date
    payment_date = Column(Date, nullable=False)

    # Link to purchase invoice
    purchase_invoice_id = Column(
        UUID(as_uuid=True),
        ForeignKey("purchase_invoices.uuid", ondelete="CASCADE"),
        nullable=False,
    )

    # Party/Vendor info (redundant but for quick access)
    party_name = Column(String(200), nullable=False)

    # Purchase Invoice Number (for reference)
    invoice_number = Column(String(50), nullable=False)

    # Financial amounts
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False)
    balance_due = Column(Numeric(12, 2), default=0)
    discount = Column(Numeric(12, 2), default=0)

    # Payment details
    payment_status = Column(String(20), default="paid", nullable=False)
    payment_mode = Column(String(50), nullable=False)

    # Additional notes
    payment_notes = Column(Text, nullable=True)
    
    # Soft delete support
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    # Business context
    business_id = Column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User who recorded this payment
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.uuid"), nullable=True)

    # Relationships
    purchase_invoice = relationship("PurchaseInvoice", backref="payment_outs")
    business = relationship("Business")
    user = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<PaymentOut {self.payment_number} | ₹{self.amount_paid} | {self.payment_mode}>"

    @property
    def is_fully_paid(self):
        return self.balance_due <= 0

    @property
    def payment_percentage(self):
        if self.total_amount == 0:
            return 0
        return float((self.amount_paid / self.total_amount) * 100)
