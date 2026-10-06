# Native Windows Setup Guide

## 1. Prerequisites
- **Node.js**: Install the latest LTS version.
- **Python**: Install Python 3.11+.
- **PostgreSQL**: Install PostgreSQL locally. Create a database (e.g., `study_assistant`) and user, and update `.env` accordingly.
- **Ollama**: Download and install Ollama for Windows. Pull the required model: `ollama pull qwen3:4b`.
- **Tesseract OCR**: Install Tesseract OCR for Windows. Ensure the installation path is added to your system `PATH` and you have installed the English (`eng`) training data.

## 2. Automated Setup
1. Open PowerShell.
2. Navigate to the project root.
3. Run `.\scripts\setup.ps1`. This will:
   - Create a Python virtual environment in `backend\.venv`
   - Install all Python backend dependencies
   - Run Alembic migrations to set up the DB tables
   - Seed the database with the default `user` account
   - Install Node packages via `npm install` in the `frontend` directory.

## 3. Running the Application
Use `.\scripts\start-dev.ps1` to spin up Chroma, the API worker, the FastAPI backend, and the Vite frontend simultaneously.
Access the web UI at http://localhost:5169.
