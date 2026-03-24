from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class DebitNote(BaseMixin, db.Model):
    __tablename__ = "debit_notes"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debit_note_number = Column(String(50), unique=True, nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.uuid", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    # Link to source purchase invoice (optional - debit note can exist without invoice)
    invoice_id = Column(UUID(as_uuid=True), nullable=True)  # Remove FK constraint
    invoice_number = Column(String(50), nullable=True)  # Store invoice number for reference
    
    # Store original invoice payment_status for restoration
    original_invoice_payment_status = Column(String(20), nullable=True)
    debit_note_date = Column(Date, nullable=False)
    status = Column(String(20), default="Unpaid", nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_received = Column(Numeric(12, 2), default=0)
    balance_amount = Column(Numeric(12, 2), default=0)
    charges = Column(JSON, default={})
    mark_as_fully_paid = Column(Boolean, default=False)
    auto_round_off = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    additional_notes = Column(JSON, default={})

    # Relationships
    business = relationship("Business")
    vendor = relationship("Vendor")
    items = relationship("DebitNoteItem", back_populates="debit_note", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DebitNote {self.debit_note_number} | ₹{self.total_amount}>"

    # Helper methods to work with charges JSON
    @property
    def subtotal(self):
        return self.charges.get('subtotal', 0) if self.charges else 0
    
    @subtotal.setter
    def subtotal(self, value):
        if not self.charges:
            self.charges = {}
        self.charges['subtotal'] = float(value)
    
    @property
    def total_discount(self):
        return self.charges.get('total_discount', 0) if self.charges else 0
    
    @total_discount.setter
    def total_discount(self, value):
        if not self.charges:
            self.charges = {}
        self.charges['total_discount'] = float(value)
    
    @property
    def total_tax(self):
        return self.charges.get('total_tax', 0) if self.charges else 0
    
    @total_tax.setter
    def total_tax(self, value):
        if not self.charges:
            self.charges = {}
        self.charges['total_tax'] = float(value)
    
    @property
    def taxable_amount(self):
        return self.charges.get('taxable_amount', 0) if self.charges else 0
    
    @taxable_amount.setter
    def taxable_amount(self, value):
        if not self.charges:
            self.charges = {}
        self.charges['taxable_amount'] = float(value)
    
    @property
    def round_off_amount(self):
        return self.charges.get('round_off_amount', 0) if self.charges else 0
    
    @round_off_amount.setter
    def round_off_amount(self, value):
        if not self.charges:
            self.charges = {}
        self.charges['round_off_amount'] = float(value)


class DebitNoteItem(BaseMixin, db.Model):
    __tablename__ = "debit_note_items"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debit_note_id = Column(UUID(as_uuid=True), ForeignKey("debit_notes.uuid", ondelete="CASCADE"), nullable=False)

    # Link to Inventory Item
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    
    # Item details (stored for historical record)
    hsn_sac_code = Column(String(20), nullable=True)  # Made optional like in invoice
    description = Column(Text, nullable=True)

    # Pricing
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Discount (JSON blob) - matching frontend structure
    # Expected: { discount_percentage, discount_amount }
    discount = Column(JSON, default={})

    # Tax (JSON blob) - matching frontend structure
    # Expected: { tax_percentage, tax_amount }
    tax = Column(JSON, default={})

    total_price = Column(Numeric(12, 2), nullable=False)
    
    # Note: measuring_unit_id removed as per new SQL schema

    # Relationships
    debit_note = relationship("DebitNote", back_populates="items")
    item = relationship("Item")
    # measuring_unit relationship removed as per new SQL schema

    def __repr__(self):
        return f"<DebitNoteItem {self.uuid} | Qty: {self.quantity}>"

    # Helper methods to work with discount JSON
    @property
    def discount_percentage(self):
        return self.discount.get('discount_percentage', 0) if self.discount else 0
    
    @discount_percentage.setter
    def discount_percentage(self, value):
        if not self.discount:
            self.discount = {}
        self.discount['discount_percentage'] = float(value)
    
    # Helper methods to work with tax JSON
    @property
    def tax_percentage(self):
        return self.tax.get('tax_percentage', 0) if self.tax else 0
    
    @tax_percentage.setter
    def tax_percentage(self, value):
        if not self.tax:
            self.tax = {}
        self.tax['tax_percentage'] = float(value)


class DebitNotePayment(BaseMixin, db.Model):
    __tablename__ = "debit_note_payments"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debit_note_id = Column(UUID(as_uuid=True), ForeignKey("debit_notes.uuid", ondelete="CASCADE"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.uuid", ondelete="CASCADE"), nullable=True)
    
    # Payment details
    payment_amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String(20), nullable=False)  # cash, card, bank_transfer, cheque, online, other
    payment_reference = Column(String(100), nullable=True)
    payment_notes = Column(Text, nullable=True)
    
    # Status
    status = Column(String(20), default="completed", nullable=False)  # pending, completed, failed, refunded
    
    # Soft delete column
    is_deleted = Column(Boolean, default=False, nullable=False)

    # Relationships
    debit_note = relationship("DebitNote", backref="payments")
    invoice = relationship("Invoice")

    def __repr__(self):
        return f"<DebitNotePayment {self.uuid} | ₹{self.payment_amount}>"
