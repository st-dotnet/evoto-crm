from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db


class PurchaseOrder(BaseMixin, db.Model):
    __tablename__ = "purchase_orders"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Human-readable PO number (e.g. PO-1001)
    po_number = Column(String(50), unique=True, nullable=False)

    # Party / Owner
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    vendor_id   = Column(UUID(as_uuid=True), ForeignKey("vendors.uuid", ondelete="SET NULL"), nullable=True)

    # Dates
    po_date       = Column(Date, nullable=False)
    delivery_date = Column(Date, nullable=True)

    # Financials — keep total_amount top-level for easy querying / sorting
    total_amount = Column(Numeric(12, 2), nullable=False)

    # Other charges grouped in JSON
    # Expected: { subtotal, tax_total, discount_total, additional_charges_total, round_off }
    charges = Column(JSON, default={})

    # Status — open | closed | received
    status = Column(String(20), default="open", nullable=False)

    # Extra document details (JSON blob)
    # Expected: { notes, terms_and_conditions, version }
    additional_notes = Column(JSON, default={})

    # Relationships
    vendor = relationship("Vendor")
    items  = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_purchase_orders_vendor_id",                "vendor_id"),
        Index("idx_purchase_orders_business_id",              "business_id"),
        Index("idx_purchase_orders_status",                   "status"),
        Index("idx_purchase_orders_status_delivery_date",     "status", "delivery_date"),
        Index("idx_purchase_orders_business_status_delivery", "business_id", "status", "delivery_date"),
        Index("idx_purchase_orders_created_at",               "created_at"),
    )

    def __repr__(self):
        return f"<PurchaseOrder {self.po_number} | ₹{self.total_amount}>"


class PurchaseOrderItem(BaseMixin, db.Model):
    __tablename__ = "purchase_order_items"

    uuid              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.uuid", ondelete="CASCADE"),
        nullable=False,
    )

    # Link to Inventory Item
    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Optional line-item description / notes
    description = Column(Text, nullable=True)

    # Pricing
    quantity   = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)

    # Discount — { discount_percentage, discount_amount }
    discount = Column(JSON, default={})

    # Tax — { tax_percentage, tax_amount }
    tax = Column(JSON, default={})

    # Final line total
    total_price = Column(Numeric(12, 2), nullable=False)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")
    item           = relationship("Item")

    __table_args__ = (
        Index("idx_purchase_order_items_po_id",   "purchase_order_id"),
        Index("idx_purchase_order_items_item_id", "item_id"),
    )

    def __repr__(self):
        return f"<PurchaseOrderItem {self.uuid} | Qty: {self.quantity}>"
