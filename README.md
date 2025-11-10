# Coloring Book Generator

A small full‑stack app to generate, view, and print coloring pages. Backend: TypeScript/Express. Frontend: React + Vite.

## Prerequisites
- Node.js 20+ and npm
- Docker (optional) and Docker Compose

## Local Development
- Backend (API at `http://localhost:3000`):
  - `cd backend`
  - `npm i`
  - `npm run dev`
- Frontend (Vite at `http://localhost:5173`, proxy to backend):
  - `cd frontend`
  - `npm i`
  - `npm run dev`

## Local Production (no Docker)
- Backend:
  - `cd backend`
  - `npm i && npm run build`
  - `npm start`
- Frontend:
  - `cd frontend`
  - `npm i && npm run build`
  - `npm run preview`

## Docker Compose
- Example compose building locally instead of pulling images:

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      - NODE_ENV=production
      - DATA_DIR=/data
      - OPENAI_API_KEY=sk-... # Your API Key
      - PRINTER_URI=ipp://<host-or-ip>/ipp/print # Your printer url
      - OPENAI_IMAGE_MODEL=gpt-image-1
      - OPENAI_TEXT_MODEL=gpt-5-mini
      - OPENAI_STT_MODEL=whisper-1
      - OPENAI_TIMEOUT_MS=120000
      - APP_PASSWORD=yourpassword # optional
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 5
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "5173:80"
```

## Notes
- Do not commit secrets. 
- Ensure `DATA_DIR` is writable (mapped volume in Docker, or `backend/data` locally).
