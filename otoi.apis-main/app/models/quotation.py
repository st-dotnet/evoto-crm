from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class Quotation(BaseMixin, db.Model):
    __tablename__ = "quotations"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Human readable ID (e.g. QT-1001)
    quotation_number = Column(String(50), unique=True, nullable=False)
    
    # Party / Owner
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.uuid"), nullable=False)

    # Dates
    quotation_date = Column(Date, nullable=False)
    valid_till = Column(Date, nullable=True)

    # Financials - Keep total_amount top-level for easy querying/sorting
    total_amount = Column(Numeric(12, 2), nullable=False)
    
    # Other charges grouped in JSON
    # Expected: { subtotal, tax_total, discount_total, additional_charges_total, round_off }
    charges = Column(JSON, default={})

    # Status (open, sent, accepted, rejected, expired, invoiced)
    status = Column(String(20), default="open", nullable=False)

    # Extra Document Details (JSON blob)
    # Expected: { notes, terms_and_conditions, version }
    additional_notes = Column(JSON, default={})

    # Relationships
    business = relationship("Business")
    customer = relationship("Customer")
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")

    __table_args__ = (
        # FK lookup indexes
        Index('idx_quotations_customer_id',  'customer_id'),
        Index('idx_quotations_business_id',  'business_id'),
        # Status / expiry — powers bulk UPDATE and listing sort
        Index('idx_quotations_status',                    'status'),
        Index('idx_quotations_status_valid_till',         'status', 'valid_till'),
        Index('idx_quotations_business_status_valid_till','business_id', 'status', 'valid_till'),
        # Pagination / number generation
        Index('idx_quotations_created_at',   'created_at'),
    )

    def __repr__(self):
        return f"<Quotation {self.quotation_number} | ₹{self.total_amount}>"


class QuotationItem(BaseMixin, db.Model):
    __tablename__ = "quotation_items"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.uuid", ondelete="CASCADE"), nullable=False)

    # Link to Inventory Item (product_name, hsn_code, measuring_unit can be fetched from here)
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    
    # Optional description/notes for this specific line item
    description = Column(Text, nullable=True)

    # Pricing
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Discount (JSON blob)
    # Expected: { discount_percentage, discount_amount }
    discount = Column(JSON, default={})

    # Tax (JSON blob)
    # Expected: { tax_percentage, tax_amount }
    tax = Column(JSON, default={})

    # Final line total
    total_price = Column(Numeric(12, 2), nullable=False)

    # Relationships
    quotation = relationship("Quotation", back_populates="items")
    item = relationship("Item")

    __table_args__ = (
        # FK indexes — used in selectinload and batch IN queries
        Index('idx_quotation_items_quotation_id', 'quotation_id'),
        Index('idx_quotation_items_item_id',      'item_id'),
    )

    def __repr__(self):
        return f"<QuotationItem {self.uuid} | Qty: {self.quantity}>"
