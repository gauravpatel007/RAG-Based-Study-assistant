"""add_user_quota_and_soft_delete

Revision ID: 0009
Revises: bfb86b13ff9c
Create Date: 2026-10-02 16:04:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0009'
down_revision: Union[str, None] = 'bedb78139979'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('users', sa.Column('storage_quota_bytes', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'storage_quota_bytes')
