import json

import httpx

from app import providers
from app.core.settings import settings, Settings, PROJECT_ROOT


async def test_local_request_disables_thinking_without_mutating_history(monkeypatch):
    captured = []
    def respond(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, content=b'{"message":{"content":"Answer"}}\n{"done":true}\n')
    client_type = httpx.AsyncClient
    monkeypatch.setattr(providers.httpx, 'AsyncClient', lambda **kwargs: client_type(transport=httpx.MockTransport(respond), **kwargs))
    monkeypatch.setattr(settings, 'LLM_MODEL', 'qwen3:4b')
    messages = [{'role': 'user', 'content': 'Explain attention.'}]
    schema = {'type': 'object'}
    assert ''.join([p async for p in providers.generate(messages, structured=schema, max_tokens=240)]) == 'Answer'
    assert messages[0]['content'] == 'Explain attention.'
    body = captured[0]
    assert body['think'] is False and body['messages'][-1]['content'].endswith('/no_think')
    assert body['format'] == schema and body['options']['num_predict'] == 240
    assert body['keep_alive'] == '15m'


def test_storage_paths_do_not_depend_on_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = Settings(_env_file=None, STORAGE_ROOT='data', TESSDATA_PREFIX='data/tessdata')
    assert config.STORAGE_ROOT == PROJECT_ROOT / 'data'
    assert config.TESSDATA_PREFIX == PROJECT_ROOT / 'data/tessdata'
