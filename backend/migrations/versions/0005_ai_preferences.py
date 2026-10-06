
"""add ai preferences to user preferences

Revision ID: 0005_ai_preferences
Revises: 0004_add_comparison
Create Date: 2026-09-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005_ai_preferences'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('response_length', sa.String(length=20), server_default='medium', nullable=False))
        batch_op.add_column(sa.Column('explanation_level', sa.String(length=50), server_default='undergraduate', nullable=False))
        batch_op.add_column(sa.Column('not_in_docs_behavior', sa.String(length=20), server_default='tell_me', nullable=False))
        batch_op.add_column(sa.Column('citation_style', sa.String(length=20), server_default='inline', nullable=False))
        batch_op.add_column(sa.Column('default_search_scope', sa.String(length=20), server_default='selected', nullable=False))
        batch_op.add_column(sa.Column('follow_up_suggestions', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('simplify_difficult_concepts', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('external_knowledge', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.drop_column('external_knowledge')
        batch_op.drop_column('simplify_difficult_concepts')
        batch_op.drop_column('follow_up_suggestions')
        batch_op.drop_column('default_search_scope')
        batch_op.drop_column('citation_style')
        batch_op.drop_column('not_in_docs_behavior')
        batch_op.drop_column('explanation_level')
        batch_op.drop_column('response_length')
