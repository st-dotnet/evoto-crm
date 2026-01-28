from sqlalchemy import Column, String, Float, Boolean, Date, text
from sqlalchemy.dialects.postgresql import UUID
from app.extensions import db
from app.models.common import BaseMixin
import uuid

class PurchaseEntry(BaseMixin, db.Model):
    __tablename__ = "purchase_entries"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    invoice_number = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    entered_bill = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<PurchaseEntry(invoice_number={self.invoice_number}, amount={self.amount})>"
