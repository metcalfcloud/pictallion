# Pictallion Development Setup Guide

This guide describes how to set up a development environment for the Python FastAPI backend and React frontend.

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (local or Docker)
- Optional: Ollama (local AI), OpenAI API key

## Backend Setup

```bash
cd server_py
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your settings
python manage_db.py migrate
python -m uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

- Frontend runs on http://localhost:5173
- Backend API runs on http://localhost:8000

## Dual Workflow

- Frontend API requests are proxied to backend
- Edit both frontend and backend code independently
- Use test data and scripts in [`scripts/`](scripts/) for development

## Testing

- Backend: `pytest` (see [`server_py/README.md`](server_py/README.md:1))
- Frontend: `npm run test`

## Troubleshooting

- Check environment variables in `.env`
- Validate database connection
- Review logs for errors

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)