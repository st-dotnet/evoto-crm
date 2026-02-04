from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class Invoice(BaseMixin, db.Model):
    __tablename__ = "invoices"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Human readable ID (e.g. INV-1001)
    invoice_number = Column(String(50), unique=True, nullable=False)
    
    # Link to source quotation (optional - invoice can exist without quotation)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.uuid", ondelete="SET NULL"), nullable=True)
    
    # Party / Owner
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.uuid"), nullable=False)

    # Dates
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    # Financials - Keep key amounts top-level for querying
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=0)
    balance_due = Column(Numeric(12, 2), default=0)
    
    # Other charges grouped in JSON
    # Expected: { subtotal, tax_total, discount_total, additional_charges_total, round_off }
    charges = Column(JSON, default={})

    # Status (draft, sent, paid, partial, overdue, void)
    status = Column(String(20), default="draft", nullable=False)
    
    # Payment status (unpaid, partial, paid)
    payment_status = Column(String(20), default="unpaid", nullable=False)

    # Extra details (JSON blob)
    # Expected: { notes, terms_and_conditions, payment_terms }
    additional_notes = Column(JSON, default={})

    # Relationships
    quotation = relationship("Quotation", backref="invoice")
    business = relationship("Business")
    customer = relationship("Customer")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Invoice {self.invoice_number} | ₹{self.total_amount}>"


class InvoiceItem(BaseMixin, db.Model):
    __tablename__ = "invoice_items"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.uuid", ondelete="CASCADE"), nullable=False)

    # Link to Inventory Item
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    
    description = Column(Text, nullable=True)

    # Pricing
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Discount (JSON blob)
    discount = Column(JSON, default={})

    # Tax (JSON blob)
    tax = Column(JSON, default={})

    total_price = Column(Numeric(12, 2), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    item = relationship("Item")

    def __repr__(self):
        return f"<InvoiceItem {self.uuid} | Qty: {self.quantity}>"
