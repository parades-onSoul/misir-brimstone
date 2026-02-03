# Misir - Orientation Engine

A multi-component system for capturing, processing, and visualizing knowledge through spatial representations.

## Project Structure

### Backend (`/backend`)
FastAPI-based Python backend providing:
- Knowledge ingestion pipeline
- Mathematical subspace engine
- Embeddings and semantic processing
- REST API for frontend integration

**Setup:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
cp .env .env.local  # Configure your environment variables
uvicorn app.main:app --reload
```

### Extension (`/extension`)
Browser extension for capturing web content:
- Content capture and classification
- Local NLP processing
- Supabase sync

**Setup:**
```bash
cd extension
npm install
npm run dev  # Development build
npm run build  # Production build
```

Load the extension in Chrome:
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` folder

### Web App (`/misir-app`)
Next.js application for visualization and interaction:
- Dashboard for spaces and signals
- 3D/2D visualizations using D3.js and PixiJS
- Real-time sync with backend

**Setup:**
```bash
cd misir-app
npm install
cp .env.local.example .env.local  # Configure your environment variables
npm run dev
```

## Environment Variables

Each component requires environment configuration:

### Backend `.env`
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase service role key
- `PROJECT_NAME`: Project identifier
- `CORS_ORIGINS`: Allowed origins for CORS

### Extension `.env`
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_BACKEND_URL`: Backend API URL

### Misir App `.env.local`
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL
- `GEMINI_API_KEY`: (Optional) Google Gemini API key

## Documentation

See `/Docs` for detailed documentation:
- `backend-documentation.md` - Backend architecture and API
- `extension-documentation.md` - Extension features and setup
- `DEVELOPER_HANDOFF.md` - Development guidelines

## Tech Stack

- **Backend**: FastAPI, Python, NumPy, SciPy, Sentence Transformers
- **Extension**: TypeScript, Vite, React, Supabase
- **Web App**: Next.js, React, TypeScript, D3.js, PixiJS, Tailwind CSS
- **Database**: Supabase (PostgreSQL)

## License

Proprietary - All rights reserved
