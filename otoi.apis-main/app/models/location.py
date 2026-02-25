from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from app.extensions import db
import uuid
import datetime

class Country(db.Model):
    __tablename__ = "countries"

    country_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_name = Column(String(150), nullable=False, unique=True)
    iso_code = Column(String(10))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class UnionTerritory(db.Model):
    __tablename__ = "union_territories"

    territory_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    territory_name = Column(String(150), nullable=False, unique=True)
    country_id = Column(UUID(as_uuid=True), ForeignKey("countries.country_id", ondelete="CASCADE"), nullable=False)
    territory_type = Column(String(100), nullable=False)
    capital = Column(String(150))
    is_capital_territory = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
