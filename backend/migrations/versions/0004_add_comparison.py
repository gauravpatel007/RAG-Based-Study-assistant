"""Add Comparison

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-27 20:17:15.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('comparisons',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('chat_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('query', sa.String(length=500), nullable=False),
    sa.Column('document_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('generated_comparison', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('comparisons')
