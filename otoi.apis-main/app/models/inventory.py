from sqlalchemy import Column, Integer, String, ForeignKey, Float, Boolean, Text, LargeBinary
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.common import BaseMixin


class ItemType(BaseMixin, db.Model):
    __tablename__ = "item_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    # Relationships
    items = relationship("Item", back_populates="item_type")


class ItemCategory(BaseMixin, db.Model):
    __tablename__ = "item_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    # Relationships
    items = relationship("Item", back_populates="category")


class MeasuringUnit(BaseMixin, db.Model):
    __tablename__ = "measuring_units"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)

    # Relationships
    items = relationship("Item", back_populates="measuring_unit")


class Item(BaseMixin, db.Model):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_type_id = Column(Integer, ForeignKey("item_types.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("item_categories.id", ondelete="CASCADE"), nullable=False)
    measuring_unit_id = Column(Integer, ForeignKey("measuring_units.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False, unique=True)
    sales_price = Column(Float, nullable=False)
    purchase_price = Column(Float, nullable=False)
    gst_tax_rate = Column(Float, nullable=False)
    opening_stock = Column(Float, nullable=False)
    item_code = Column(String(100), nullable=False, unique=True)
    hsn_code = Column(String(50), nullable=True)
    enable_low_quantity_warning = Column(Boolean, default=False)
    description = Column(Text, nullable=True)

    # Relationships
    item_type = relationship("ItemType", back_populates="items")
    category = relationship("ItemCategory", back_populates="items")
    measuring_unit = relationship("MeasuringUnit", back_populates="items")
    images = relationship("ItemImage", back_populates="item")


class ItemImage(BaseMixin, db.Model):
    __tablename__ = "item_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    image = Column(LargeBinary, nullable=False)

    # Relationships
    item = relationship("Item", back_populates="images")

ItemType.items = relationship("Item", back_populates="item_type")
ItemCategory.items = relationship("Item", back_populates="category")
MeasuringUnit.items = relationship("Item", back_populates="measuring_unit")
Item.images = relationship("ItemImage", back_populates="item")