from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.extensions import db
import uuid
 
 
class Customer(db.Model):
    __tablename__ = "customers"
 
    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.uuid", ondelete="CASCADE"), unique=True, nullable=False)
 
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    mobile = Column(String(15), nullable=False, unique=True)
    email = Column(String(255), nullable=True)
    gst = Column(String(20), nullable=True)
    status = Column(String(80), nullable=False)
 
    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pin = Column(String(20), nullable=False)
 
    # Relationship back to Lead
    lead = relationship("Lead", back_populates="customers")
    
 