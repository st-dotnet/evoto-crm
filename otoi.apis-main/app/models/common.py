from sqlalchemy import Column, Integer, ForeignKey, DateTime, String
from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.extensions import db

class BaseMixin:
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



class Address(BaseMixin, db.Model):
    __tablename__ = "addresses"

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False)

    # 🔑 THIS links address to ABC Pvt Ltd
    business_id = Column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=True
    )

    business = relationship("Business", back_populates="addresses")
    leads = relationship("Lead", secondary="lead_addresses", back_populates="addresses", viewonly=True)
    lead_addresses = relationship("LeadAddress", back_populates="address", cascade="all, delete-orphan")
    business = relationship("Business", back_populates="addresses")

    # Direct many-to-many with Lead (through lead_addresses)
    leads = relationship("Lead", secondary="lead_addresses", back_populates="addresses", overlaps="lead_addresses")

    def __repr__(self):
        return f"<Address {self.address1}, {self.city}>"
