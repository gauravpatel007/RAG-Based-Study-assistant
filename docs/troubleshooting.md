# Troubleshooting

## Local CPU Performance Issues
If generating answers takes too long or uses too much memory:
- Check Task Manager to ensure you have enough free RAM (at least 8GB available).
- Ensure Ollama is configured to use only 1 concurrent generation (`OLLAMA_MAX_QUEUE=1`).
- You can change the model from `qwen3:4b` to a smaller/more quantized version if necessary.

## Missing OCR Dependencies
If scanned PDFs result in blank text and extraction fails:
- Check if Tesseract is installed and in your Windows `PATH`.
- Check if the `eng` language pack is installed.
- Open PowerShell and run `tesseract --version`.

## Port Collisions
- FastAPI uses `8000`.
- Chroma uses `8001`.
- Vite uses `5169`.
- PostgreSQL uses `5432`.
- Ollama uses `11434`.
If a service fails to start, use `netstat -ano | findstr <port>` to find the PID of the conflicting process and kill it.
