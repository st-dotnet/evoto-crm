from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import DateTime
from app.extensions import db
from datetime import datetime
import uuid


class Vendor(db.Model):
    __tablename__ = "vendors"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    company_name = Column(String(200), nullable=False)
    vendor_name = Column(String(200), nullable=True)
    mobile = Column(String(15), nullable=True, unique=True)
    email = Column(String(255), nullable=True)
    gst = Column(String(20), nullable=True)

    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.uuid", ondelete="SET NULL"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.uuid", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
