# System Architecture

## Overview
Study Assistant is a locally hosted, RAG-enabled chatbot designed to help users interact with PDF textbooks. It uses a React/Vite frontend and a FastAPI Python backend, with local ML models for data ingestion and text generation.

## Components
1. **Frontend (React + Vite)**: 
   - Uses declarative React Router for navigation.
   - Proxies API requests to the FastAPI backend during development.
2. **Backend (FastAPI)**:
   - Manages sessions, users, authentication, and HTTP request routing.
   - Communicates with PostgreSQL for persistent state tracking.
3. **Background Worker (Python)**:
   - Processes asynchronous jobs like PDF extraction, chunking, and embedding.
   - Communicates with Chroma DB and Ollama.
4. **PostgreSQL**:
   - Stores user profiles, chats, message history, jobs, and extracted text/chunks.
5. **Chroma DB**:
   - A local vector database containing text chunks embedded via `all-MiniLM-L6-v2`.
6. **Ollama**:
   - Serves the LLM locally (`qwen3:4b`).

## Data Flow
- **Ingestion**: Uploaded PDFs are stored in the filesystem (`data/uploads`). A background worker parses the PDF, extracts text natively (falling back to OCR if needed), chunks it, and saves embeddings to Chroma.
- **RAG Querying**: User queries are analyzed. If textbook knowledge is required, a similarity search is performed in Chroma using strict metadata filters to enforce chat isolation. The resulting chunks are passed to the local LLM to generate a cited response.

## Security & Isolation
- Each user session requires authentication.
- Chats, documents, and messages belong exclusively to the user that created them.
- Vector search requests inject explicit `user_id` and `chat_id` constraints into Chroma metadata filters to prevent cross-contamination.
