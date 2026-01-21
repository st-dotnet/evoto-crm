from sqlalchemy import Column, Integer, String, ForeignKey, Float, Boolean, Text, LargeBinary, CheckConstraint, or_
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.extensions import db
from app.models.common import BaseMixin
import uuid


class ItemType(BaseMixin, db.Model):
    __tablename__ = "item_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    # Relationships
    items = relationship(
        "Item", 
        back_populates="item_type",
        primaryjoin="and_(Item.item_type_id==ItemType.id, Item.is_deleted==False)",
        viewonly=True
    )


class ItemCategory(BaseMixin, db.Model):
    __tablename__ = "item_categories"

    uuid = Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)

    # Relationships
    items = relationship(
        "Item", 
        back_populates="category",
        primaryjoin="and_(Item.category_id==ItemCategory.uuid, Item.is_deleted==False)",
        viewonly=True
    )


class MeasuringUnit(BaseMixin, db.Model):
    __tablename__ = "measuring_units"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)

    # Relationships
    items = relationship(
        "Item", 
        back_populates="measuring_unit",
        primaryjoin="and_(Item.measuring_unit_id==MeasuringUnit.id, Item.is_deleted==False)",
        viewonly=True
    )

class ItemQuery(db.Query):
    def get(self, ident):
        # First try to get the item normally (excluding soft-deleted)
        rv = super().get(ident)
        if rv is None:
            # If not found, try including soft-deleted
            rv = self.with_deleted().filter(Item.id == ident).first()
        return rv

    def __iter__(self):
        return iter(self.filter_by(is_deleted=False))

    def with_deleted(self):
        """Return a query that includes soft-deleted items."""
        return self.filter(True if True else False)  # This will include all items, even soft-deleted


class Item(BaseMixin, db.Model):
    __tablename__ = "items"
    query_class = ItemQuery

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_type_id = Column(Integer, ForeignKey("item_types.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(db.UUID(as_uuid=True), ForeignKey("item_categories.uuid", ondelete="CASCADE"), nullable=False)
    measuring_unit_id = Column(Integer, ForeignKey("measuring_units.id", ondelete="CASCADE"), nullable=False)

    item_name = Column(String(255), nullable=False, unique=True)
    sales_price = Column(Float, nullable=False)
    gst_tax_rate = Column(Float, nullable=False)
    opening_stock = Column(Float, nullable=True)

    purchase_price = Column(Float, nullable=True)
    item_code = Column(String(100), nullable=True, unique=True)
    hsn_code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)

    enable_low_quantity_warning = Column(Boolean, default=False)

    # Soft delete column
    is_deleted = Column(Boolean, default=False)


    __table_args__ = (
        CheckConstraint(
            """
            (
                item_type_id = 1
                AND opening_stock IS NOT NULL
                AND purchase_price IS NOT NULL
            )
            OR
            (
                item_type_id = 2
                AND opening_stock IS NULL
                AND purchase_price IS NULL
            )
            """,
            name="chk_item_product_service"
        ),
    )


    # Relationships
    item_type = relationship("ItemType", back_populates="items")
    category = relationship("ItemCategory", back_populates="items")
    measuring_unit = relationship("MeasuringUnit", back_populates="items")
    images = relationship("ItemImage", back_populates="item")


class ItemImage(BaseMixin, db.Model):
    __tablename__ = "item_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    image = Column(LargeBinary, nullable=False)

    # Relationships
    item = relationship("Item", back_populates="images")


ItemType.items = relationship(
    "Item", 
    back_populates="item_type",
    primaryjoin="and_(Item.item_type_id==ItemType.id, Item.is_deleted==False)",
    viewonly=True
)
ItemCategory.items = relationship(
    "Item", 
    back_populates="category",
    primaryjoin="and_(Item.category_id==ItemCategory.uuid, Item.is_deleted==False)",
    viewonly=True
)
MeasuringUnit.items = relationship(
    "Item", 
    back_populates="measuring_unit",
    primaryjoin="and_(Item.measuring_unit_id==MeasuringUnit.id, Item.is_deleted==False)",
    viewonly=True
)
Item.images = relationship("ItemImage", back_populates="item")