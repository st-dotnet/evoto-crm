from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, Numeric, ForeignKey, String, Text, Date, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.extensions import db


class Quotation(BaseMixin, db.Model):
    __tablename__ = "quotations"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Party / Owner
    business_id = Column(Integer,ForeignKey("businesses.id", ondelete="CASCADE"),nullable=False)

    customer_id = Column(UUID(as_uuid=True),ForeignKey("customers.uuid"),nullable=False)
    # Address references (SAME table, different usage)
    billing_address_id = Column(UUID(as_uuid=True),ForeignKey("addresses.uuid", ondelete="RESTRICT"),nullable=False)

    shipping_address_id = Column(UUID(as_uuid=True),ForeignKey("addresses.uuid", ondelete="RESTRICT"),nullable=False)

    # Quotation info
    quotation_date = Column(Date, nullable=False)
    valid_till = Column(Date, nullable=True)

    subtotal = Column(Numeric(12, 2), default=0)
    tax_total = Column(Numeric(12, 2), default=0)
    discount_total = Column(Numeric(12, 2), default=0)
    additional_charges_total = Column(Numeric(12, 2), default=0)
    round_off = Column(Numeric(12, 2), default=0)

    total_amount = Column(Numeric(12, 2), nullable=False)

    status = Column(String(20),default="open",nullable=False)  # open | sent | accepted | rejected | expired




    # Relationships
    billing_address = relationship("Address", foreign_keys=[billing_address_id])

    shipping_address = relationship("Address", foreign_keys=[shipping_address_id])
    business = relationship("Business")
    customer = relationship("Customer")
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Quotation {self.uuid} | Total={self.total_amount}>"
    

class QuotationItem(BaseMixin, db.Model):
    __tablename__ = "quotation_items"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    quotation_id = Column(UUID(as_uuid=True),ForeignKey("quotations.uuid", ondelete="CASCADE"),nullable=False)

    product_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    hsn_sac_code = Column(String(20), nullable=True)

    quantity = Column(Numeric(10, 2), nullable=False)
    measuring_unit_id = Column(Integer, ForeignKey("measuring_units.id"), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)

    price_before_discount = Column(Numeric(12, 2), nullable=False)

    discount_percentage = Column(Numeric(5, 1), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)

    tax_percentage = Column(Numeric(5, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)

    total_amount = Column(Numeric(12, 2), nullable=False)

    # Per-product fields
    terms_and_conditions = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    quotation = relationship("Quotation", back_populates="items")
    measuring_unit = relationship("MeasuringUnit")

    def __repr__(self):
        return f"<QuotationItem {self.product_name}>"    
