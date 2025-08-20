from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.common import BaseMixin


class LeadStatusType(BaseMixin, db.Model):
    __tablename__ = "lead_status_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)

    # Relationships
    statuses = relationship("LeadStatus", back_populates="status_type")


class LeadStatus(BaseMixin, db.Model):
    __tablename__ = "lead_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    lead_status_type_id = Column(Integer, ForeignKey("lead_status_types.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    lead = relationship("Lead", back_populates="statuses")
    status_type = relationship("LeadStatusType", back_populates="statuses")


class FollowUp(BaseMixin, db.Model):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    follow_up_date = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="followups")


class Lead(BaseMixin, db.Model):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    phone = Column(String(15), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    zip = Column(String(20), nullable=True)

    # Relationships
    followups = relationship("FollowUp", back_populates="lead")
    statuses = relationship("LeadStatus", back_populates="lead")

LeadStatusType.statuses = relationship("LeadStatus", back_populates="status_type")
Lead.followups = relationship("FollowUp", back_populates="lead")
Lead.statuses = relationship("LeadStatus", back_populates="lead")