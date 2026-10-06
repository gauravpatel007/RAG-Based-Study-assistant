"""add answer_format to user_preferences

Revision ID: 0006_add_answer_format
Revises: 0005_ai_preferences
Create Date: 2026-09-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006_add_answer_format'
down_revision: Union[str, None] = '0005_ai_preferences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('answer_format', sa.String(length=30), server_default='paragraph', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.drop_column('answer_format')
