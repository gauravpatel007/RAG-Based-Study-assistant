import sys

with open('app/worker.py', 'r') as f:
    content = f.read()

content = content.replace('from app.core.settings import settings', 'from app.core.settings import settings\nfrom app.core.dynamic_settings import dyn_settings')
content = content.replace('settings.LLM_CONTEXT_TOKENS', '(await dyn_settings.get("LLM_CONTEXT_TOKENS", settings.LLM_CONTEXT_TOKENS))')
content = content.replace('settings.LLM_MAX_OUTPUT_TOKENS', '(await dyn_settings.get("LLM_MAX_OUTPUT_TOKENS", settings.LLM_MAX_OUTPUT_TOKENS))')
content = content.replace('settings.LLM_MODEL', '(await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL))')
content = content.replace('settings.RETRIEVAL_MAX_DISTANCE', '(await dyn_settings.get("RETRIEVAL_MAX_DISTANCE", settings.RETRIEVAL_MAX_DISTANCE))')

with open('app/worker.py', 'w') as f:
    f.write(content)
