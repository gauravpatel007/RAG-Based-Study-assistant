import asyncio
import json
from types import SimpleNamespace
from uuid import UUID

from sqlalchemy import select

from app import providers, worker
from app.core.database import async_session_factory
from app.models.models import Job, QuizSet
from app.quiz_generation import prepare_quiz_batch
from test_application import chat, upload, index_all, local_providers  # noqa: F401


async def setup_quiz(signed):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    response = await signed.post(f'/api/v1/chats/{cid}/quiz-sets', json={
        'document_ids': [doc['document_id']], 'count': 10})
    assert response.status_code == 202, response.text
    return response.json()


async def test_quiz_reuses_saved_text_in_one_call(signed, local_providers, monkeypatch):
    ids = await setup_quiz(signed)
    def forbidden(*args, **kwargs):
        raise AssertionError('No PDF extraction or embedding during quiz generation')
    monkeypatch.setattr(worker, 'extract_page', forbidden)
    for name in ['collection', 'encoder', 'embed']:
        monkeypatch.setattr(providers, name, forbidden)
    calls = []
    async def generate(prompt, **kwargs):
        calls.append(prompt)
        yield json.dumps({'questions': [{'q': f'Question {i}?', 'a': 'Chain rule', 'b': 'Addition',
            'c': 'Subtraction', 'd': 'Division', 'ans': 'a', 'exp': 'Computes gradients.', 's': [0]} for i in range(10)]})
    monkeypatch.setattr(providers, 'generate', generate)
    await worker.process_one()
    result = (await signed.get(f"/api/v1/quiz-sets/{ids['quiz_set_id']}")).json()
    assert result['status'] == 'complete' and len(result['questions']) == 10
    assert len(calls) == 1


async def test_cancel_without_worker_updates_quiz_immediately(signed, local_providers):
    ids = await setup_quiz(signed)
    response = await signed.post(f"/api/v1/jobs/{ids['job_id']}/cancel")
    assert response.json()['status'] == 'cancelled'
    result = (await signed.get(f"/api/v1/quiz-sets/{ids['quiz_set_id']}")).json()
    assert result['status'] == result['job_status'] == 'cancelled'
    assert not await worker.process_one()


async def test_cancel_closes_stream_before_first_token(signed, local_providers, monkeypatch):
    ids = await setup_quiz(signed)
    started, closed = asyncio.Event(), asyncio.Event()
    async def generate(*args, **kwargs):
        try:
            started.set()
            await asyncio.Event().wait()
            yield ''
        finally:
            closed.set()
    monkeypatch.setattr(providers, 'generate', generate)
    task = asyncio.create_task(worker.process_one())
    try:
        await asyncio.wait_for(started.wait(), 3)
        await signed.post(f"/api/v1/jobs/{ids['job_id']}/cancel")
        await asyncio.wait_for(closed.wait(), 3)
        await asyncio.wait_for(task, 3)
        result = (await signed.get(f"/api/v1/quiz-sets/{ids['quiz_set_id']}")).json()
        assert result['status'] == 'cancelled' and result['questions'] == []
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


async def test_old_worker_failure_cannot_leave_quiz_spinning(signed, local_providers):
    ids = await setup_quiz(signed)
    async with async_session_factory() as db:
        job = await db.get(Job, UUID(ids['job_id']))
        job.status, job.error_code = 'failed', 'KeyError'
        item = await db.get(QuizSet, UUID(ids['quiz_set_id']))
        item.status = 'running'
        await db.commit()
    result = (await signed.get(f"/api/v1/quiz-sets/{ids['quiz_set_id']}")).json()
    assert result['status'] == result['job_status'] == 'failed'


def test_twenty_one_pages_ten_mcqs_fit_one_prompt():
    rows = [SimpleNamespace(text=f'Page {i}: ' + 'Neural networks learn representations. ' * 100) for i in range(21)]
    batch, prompt, schema, tokens = prepare_quiz_batch(rows, 0, 10, 'medium', 4096)
    assert batch[0] is rows[0] and batch[-1] is rows[-1]
    assert len(json.dumps(prompt, ensure_ascii=False).encode()) + tokens + 300 <= 4096
    assert tokens == 1220
    assert schema['properties']['questions']['maxItems'] == 10

async def test_cancel_pending_upload_also_updates_document(signed):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    response = await signed.post(f"/api/v1/jobs/{doc['job_id']}/cancel")
    assert response.json()['status'] == 'cancelled'
    result = (await signed.get(f"/api/v1/documents/{doc['document_id']}")).json()
    assert result['status'] == 'cancelled'
