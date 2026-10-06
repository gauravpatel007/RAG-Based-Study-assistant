"""Add rag_query_logs table
Revision ID: 0010_rag_query_logs
Revises: 0009
Create Date: 2026-10-03
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = '0010_rag_query_logs'
down_revision: Union[str, Sequence[str], None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rag_query_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_id', sa.UUID(), nullable=True),
        sa.Column('message_id', sa.UUID(), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('question_preview', sa.String(300), nullable=True),
        sa.Column('doc_count', sa.Integer(), nullable=False, server_default='0'),
        # Retrieval counts
        sa.Column('semantic_results', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bm25_results', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('merged_results', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reranked_results', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('final_sources', sa.Integer(), nullable=False, server_default='0'),
        # Per-stage timing (ms) — nullable because older rows predate instrumentation
        sa.Column('embed_ms', sa.Integer(), nullable=True),
        sa.Column('vector_search_ms', sa.Integer(), nullable=True),
        sa.Column('bm25_ms', sa.Integer(), nullable=True),
        sa.Column('rrf_ms', sa.Integer(), nullable=True),
        sa.Column('rerank_ms', sa.Integer(), nullable=True),
        sa.Column('llm_ms', sa.Integer(), nullable=True),
        sa.Column('total_ms', sa.Integer(), nullable=True),
        # Citation stats
        sa.Column('citations_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('citation_repair_triggered', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('no_context_found', sa.Boolean(), nullable=False, server_default='false'),
        # User feedback  (1=helpful, -1=not helpful, NULL=no feedback)
        sa.Column('feedback', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rag_query_created', 'rag_query_logs', ['created_at'])
    op.create_index('ix_rag_query_user', 'rag_query_logs', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_rag_query_user', table_name='rag_query_logs')
    op.drop_index('ix_rag_query_created', table_name='rag_query_logs')
    op.drop_table('rag_query_logs')
