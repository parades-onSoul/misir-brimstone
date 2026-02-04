# Misir Backend v1.0 — shiro.exe

> **Version:** 1.0.0  
> **Codename:** shiro.exe  
> **Architecture:** Domain-Driven Design

---

## Quick Start

```bash
# Install
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your Supabase credentials

# Run
uvicorn main:app --reload
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/architecture.md](docs/architecture.md) | DDD layers, design decisions |
| [docs/api.md](docs/api.md) | API endpoints reference |
| [docs/algorithms.md](docs/algorithms.md) | Algorithm quick reference |
| [docs/algorithm-spec.md](docs/algorithm-spec.md) | Full algorithm specification |

---

## Structure

```
backend/
├── README.md          ← This file
├── docs/              ← Documentation
│   ├── architecture.md
│   ├── api.md
│   ├── algorithms.md
│   └── algorithm-spec.md
├── domain/            ← Business logic (pure Python)
├── application/       ← Use cases (handlers)
├── infrastructure/    ← External systems (DB, APIs)
├── interfaces/        ← API routes
├── core/              ← Shared utilities
└── main.py            ← FastAPI app
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check + info |
| `GET` | `/health` | Simple health check |
| `POST` | `/api/v1/artifacts/capture` | Capture artifact + signal |

---

## Core Algorithms

| Algorithm | Purpose |
|-----------|---------|
| **OSCL** | Online Semantic Centroid Learning |
| **WESA** | Weighted Engagement Signal Accumulation |
| **SDD** | Semantic Drift Detection |
| **ISS** | Implicit Semantic Search |

---

## Configuration

Environment variables (`.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | ⬜ | Service role key |
| `CORS_ORIGINS` | ⬜ | Allowed origins |

---

## Design Principles

1. **DB is Arbiter** — Backend validates, DB enforces
2. **Fail Soft** — Config cache never crashes
3. **Command-Shaped Writes** — No generic `.save()`
4. **Deterministic** — Same input → same output
5. **Replayable** — Signals are append-only
