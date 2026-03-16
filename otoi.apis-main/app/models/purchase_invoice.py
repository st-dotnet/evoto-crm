from app.models.common import BaseMixin
from sqlalchemy import (
    Column, Integer, Numeric, ForeignKey, String, Text, Date, JSON, Boolean
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class PurchaseInvoice(BaseMixin, db.Model):
    """
    A Purchase Invoice is created when a Purchase Order is converted into a
    supplier invoice.  Inventory stock is updated ONLY after the invoice is
    fully paid (payment_status == "paid").
    """
    __tablename__ = "purchase_invoices"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Human-readable invoice number (e.g. PINV-1001)
    invoice_number = Column(String(50), unique=True, nullable=False)

    # Source Purchase Order (nullable so standalone purchase invoices are allowed later)
    purchase_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.uuid", ondelete="SET NULL"),
        nullable=True,
    )

    # Vendor (duplicated from PO for quick access)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendors.uuid", ondelete="SET NULL"),
        nullable=True,
    )

    # Business context
    business_id = Column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Dates
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)

    # Financials
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=0, nullable=False)
    balance_due = Column(Numeric(12, 2), default=0, nullable=False)

    # Charges JSON: { subtotal, tax_total, discount_total, additional_charges_total, round_off }
    charges = Column(JSON, default={})

    # Payment status: unpaid | partial | paid
    payment_status = Column(String(20), default="unpaid", nullable=False)

    # Payment mode (cash, bank, UPI, etc.) – set when full payment is recorded
    payment_mode = Column(String(50), nullable=True)

    # Whether inventory stock has already been credited for this invoice
    inventory_updated = Column(Boolean, default=False, nullable=False)

    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)

    # Extra details JSON: { notes, terms_and_conditions }
    additional_notes = Column(JSON, default={})

    # ── Relationships ─────────────────────────────────────────────────────────
    purchase_order = relationship("PurchaseOrder", backref="purchase_invoices")
    vendor = relationship("Vendor")
    business = relationship("Business", foreign_keys=[business_id])
    items = relationship(
        "PurchaseInvoiceItem",
        back_populates="purchase_invoice",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<PurchaseInvoice {self.invoice_number} | ₹{self.total_amount} | {self.payment_status}>"


class PurchaseInvoiceItem(BaseMixin, db.Model):
    __tablename__ = "purchase_invoice_items"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_invoice_id = Column(
        UUID(as_uuid=True),
        ForeignKey("purchase_invoices.uuid", ondelete="CASCADE"),
        nullable=False,
    )

    # Link to Inventory Item
    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )

    description = Column(Text, nullable=True)

    # Pricing
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)

    # Discount JSON: { discount_percentage, discount_amount }
    discount = Column(JSON, default={})

    # Tax JSON: { tax_percentage, tax_amount }
    tax = Column(JSON, default={})

    total_price = Column(Numeric(12, 2), nullable=False)

    # Relationships
    purchase_invoice = relationship("PurchaseInvoice", back_populates="items")
    item = relationship("Item")

    def __repr__(self):
        return f"<PurchaseInvoiceItem {self.uuid} | Qty: {self.quantity}>"
