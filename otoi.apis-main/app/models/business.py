from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, Table, UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.extensions import db
from app.models.associations import user_business 
import uuid

class BusinessType(db.Model):
    __tablename__ = "business_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)


class IndustryType(db.Model):
    __tablename__ = "industry_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    # Relationships
    businesses = relationship("Business", back_populates="industry_type")


class BusinessRegistrationType(db.Model):
    __tablename__ = "business_registration_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    # Relationships
    businesses = relationship("Business", back_populates="business_registration_type")


class Business(db.Model):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    phone_number = Column(String(15), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    is_gst_registered = Column(Boolean, nullable=False, default=False)
    gst_number = Column(String(20), nullable=True, unique=True)
    pan_number = Column(String(10), nullable=True, unique=True)
    terms_and_conditions = Column(Text, nullable=True)
    signature = Column(Text, nullable=True)
    industry_type_id = Column(Integer, ForeignKey('industry_types.id', ondelete="SET NULL"))
    business_registration_type_id = Column(Integer, ForeignKey('business_registration_types.id', ondelete="SET NULL"))
    subscription_plan = Column(String(50), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    address_id = Column(UUID(as_uuid=True), ForeignKey("addresses.uuid", ondelete="CASCADE"), nullable=False)
    # Relationships
    industry_type = relationship("IndustryType", back_populates="businesses")
    business_registration_type = relationship("BusinessRegistrationType", back_populates="businesses")
    users = relationship("User", secondary=user_business, back_populates="businesses")
    address = relationship("Address", back_populates="business")
    active_types = relationship("ActiveType", back_populates="business")