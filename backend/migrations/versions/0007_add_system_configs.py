"""add system_configs table

Revision ID: 0007_add_system_configs
Revises: 0006_add_answer_format
Create Date: 2026-09-29 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0007_add_system_configs'
down_revision: Union[str, None] = '0006_add_answer_format'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use JSON for SQLite and JSONB for Postgresql
    op.create_table('system_configs',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('key')
    )


def downgrade() -> None:
    op.drop_table('system_configs')
