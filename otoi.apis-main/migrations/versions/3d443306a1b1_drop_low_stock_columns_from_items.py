from alembic import op
import sqlalchemy as sa

revision = '3d443306a1b1'
down_revision = '44301eaecb84'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('items') as batch_op:
        batch_op.drop_column('low_stock_quantity')
        batch_op.drop_column('low_stock_warning')


def downgrade():
    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('low_stock_warning', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('low_stock_quantity', sa.Float(), nullable=True))

