# Study Assistant

A local, AI-powered study application that allows you to chat with your PDF textbooks. 
All AI features run locally, with no paid APIs required.

## Features
- **Local RAG**: Upload PDFs to a chat and ask questions grounded in the text.
- **Privacy First**: Everything runs locally using `qwen3:4b` and Sentence Transformers.
- **Source Citations**: AI answers come with direct page links.
- **Topic Extraction**: Summarize important concepts from large textbooks.

## Quick Start
In Command Prompt (cmd) of the project Folder :
```cmd
stop.bat
start.bat
```

## Prerequisites
- Node.js (LTS recommended)

- Python 3.11+
- PostgreSQL
- Ollama (installed locally with the `qwen3:4b` model pulled)
- Tesseract OCR (with `eng` trained data)

## Quick Start

```powershell
# In PowerShell:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\stop-dev.ps1
.\scripts\start-dev.ps1
```

### Option 1: Automated Startup (Recommended)
1. Ensure your `.env` is configured properly (copy from `.env.example`).
2. Run `.\scripts\setup.ps1` to install dependencies and run DB migrations.
3. Run `.\scripts\doctor.ps1` to verify prerequisites.
4. Run `.\scripts\stop-dev.ps1` to stop any running or zombie processes.
5. Run `.\scripts\start-dev.ps1` to start all services.

> **Note:** If you get a PowerShell execution policy error, run PowerShell as Administrator once and execute:  
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Reloading worker changes

The API reloads automatically during development, but the AI worker does not.
After editing topic generation, providers, or worker code, restart only the worker:

```powershell
.\scripts\start-dev.ps1 -Services worker
```

The worker startup log includes the topic pipeline version and request timeout.
Existing failed topic sets retain their original error; extract again to create a
new result. Small topic requests keep their count-based output budget; the timeout
is a maximum duration, not a delay before results are returned.

### Option 2: Running Services Manually (Separate Terminals)
If you want to view logs and debug individual components, open separate terminal windows in the project root:

**Terminal 1: Start ChromaDB (Vector DB)**
```powershell
.\backend\.venv\Scripts\chroma.exe run --host 127.0.0.1 --port 8001 --path ../data/chroma
```

**Terminal 2: Start FastAPI Backend**
```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir backend
```
    
**Terminal 3: Start AI Background Worker**
```powershell
.\backend\.venv\Scripts\python.exe -m app.worker
```

**Terminal 4: Start Frontend**
```powershell
cd frontend
npm run dev
```

### Access URLs
- **Frontend App**: [http://localhost:5169](http://localhost:5169)
- **Backend API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

For detailed architecture and troubleshooting, see the `docs/` folder.
