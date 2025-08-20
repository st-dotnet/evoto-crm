from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.common import BaseMixin, Address
from datetime import datetime

class Active(BaseMixin, db.Model):
    __tablename__ = "active"

    LAId = Column(Integer, primary_key=True, autoincrement=True)
    active_type_id = Column(Integer, ForeignKey("active_types.id", ondelete="SET NULL"), nullable=True)
    comment = Column(Text, nullable= True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    referenced_by = Column(String(500), nullable=True)
    
    # Relationships
    active_type = relationship("ActiveType", back_populates="actives")
    


class ActiveType(BaseMixin, db.Model):
    __tablename__ = "active_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    # Relationships
    actives = relationship("Active", back_populates="active_type")
    business = relationship("Business", back_populates="active_types")

class LeadType(BaseMixin, db.Model):
    __tablename__ = "lead_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nulllable= False, unique=True)    

Active.active_type = relationship("ActiveType", back_populates="actives")    