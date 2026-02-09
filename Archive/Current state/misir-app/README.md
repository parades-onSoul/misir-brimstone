# Misir - Personal Orientation System

A system for tracking and visualizing your relationship with information through space-based state evolution and blob visualizations.

## 🎯 Overview

Misir helps you understand where you stand in your information world by:
- Tracking **spaces** (topics, projects, interests)
- Recording **artifacts** (web pages, documents, highlights)
- Calculating **evidence** based on your interactions
- Visualizing **state evolution** as organic blob shapes

## 🏗️ Architecture

### Core Concepts

**State Vector**: `[s₀, s₁, s₂, s₃]` - A 4-dimensional vector representing mass distribution across states:
- `s₀`: Undiscovered (aware but unexplored)
- `s₁`: Discovered (initial exploration)
- `s₂`: Engaged (active involvement)
- `s₃`: Saturated (deep understanding)

**Evidence**: Accumulated measure of interaction strength that drives state transitions.

**Artifacts**: User interactions with content, weighted by type:
- View: 1 point
- Save: 3 points
- Highlight: 5 points
- Annotate: 7 points

**Thresholds**: Evidence levels triggering state transitions:
- θ₁ = 5 (Undiscovered → Discovered)
- θ₂ = 15 (Discovered → Engaged)
- θ₃ = 30 (Engaged → Saturated)

**Decay**: Evidence decreases exponentially over time: `E(t+Δt) = E(t) * e^(-λΔt)` where λ = 0.1/day

### Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: shadcn/ui with Tailwind CSS v4, neutral theme
- **Visualization**: PixiJS for GPU-accelerated blob rendering
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Testing**: Vitest + Testing Library

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd misir-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run the development server
npm run dev
```

Visit http://localhost:3000

## 🔧 Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup

1. Go to your Supabase project SQL Editor
2. Run the schema from `lib/db/schema.sql`
3. Enable email auth in Authentication settings
4. (Optional) Enable leaked password protection

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- **Evidence Engine**: Accumulation, decay, delta calculations
- **State Transitions**: Forward/backward transitions, mass conservation
- **Invariants**: Mass conservation, non-negativity validation

## 📁 Project Structure

```
misir-app/
├── app/                      # Next.js app directory
│   ├── page.tsx             # Login/signup page
│   ├── confirm-email/       # Email confirmation page
│   ├── dashboard/           # Dashboard
│   └── api/                 # API routes
│       ├── spaces/          # Space CRUD
│       ├── artifacts/       # Artifact ingestion
│       └── snapshots/       # Snapshot generation
├── components/              # React components
│   ├── ui/                 # shadcn/ui components
│   ├── BlobCanvas.tsx      # PixiJS visualization
│   ├── login-form.tsx      # Authentication form
│   └── UserMenu.tsx        # User menu
├── lib/                    # Core libraries
│   ├── engine/            # Mathematical engine
│   │   ├── evidence.ts    # Evidence accumulation
│   │   ├── transitions.ts # State transitions
│   │   ├── invariants.ts  # Validation
│   │   └── snapshots.ts   # Snapshot generation
│   ├── visualization/     # Blob rendering
│   │   └── fields.ts      # Field functions
│   ├── db/               # Database
│   │   ├── supabase.ts   # Supabase client
│   │   ├── auth.ts       # Auth utilities
│   │   └── schema.sql    # Database schema
│   ├── auth/             # Auth context
│   └── types/            # TypeScript types
└── tests/                # Test suites
    └── engine/          # Core engine tests
```

## 🎨 Design System

### Color Theme

Using neutral (grayscale) theme with dark mode as default:
- Pure OKLCH color space for perceptual uniformity
- No color hue, only grayscale values
- Optimized for accessibility

### Blob Visualization

Each space is visualized as an organic blob where:
- **Shape**: Determined by state vector via field functions
- **Color**: Reflects dominant state (blue → green → yellow → red)
- **Size**: Related to total mass (constant at M=10)

Field functions define blob geometry:
- F₀: Compressed (undiscovered)
- F₁: Exploratory (discovered)
- F₂: Expanded (engaged)
- F₃: Dense (saturated)

## 🔐 Authentication

- Email/password authentication via Supabase Auth
- Email confirmation required before sign-in
- Row Level Security (RLS) ensures data isolation
- Auto-generated user profiles via database trigger

## 📊 API Endpoints

### `POST /api/spaces`
Create a new space.

**Request:**
```json
{
  "name": "Machine Learning",
  "description": "Learning ML fundamentals"
}
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Machine Learning",
  "state_vector": [10, 0, 0, 0],
  "evidence": 0,
  "created_at": "2025-12-17T..."
}
```

### `GET /api/spaces`
List all user's spaces.

### `POST /api/artifacts`
Record a new artifact interaction.

**Request:**
```json
{
  "space_id": "uuid",
  "url": "https://example.com/article",
  "title": "Introduction to Neural Networks",
  "artifact_type": "save",
  "relevance_score": 0.8
}
```

### `GET /api/snapshots/latest`
Get the latest snapshot for all spaces.

## 🚀 Roadmap

- [x] Dashboard page with space management
- [ ] Browser extension for automatic artifact capture
- [ ] Background decay scheduler
- [ ] Space details page
- [ ] Social sharing features
- [ ] Export/import functionality

## 📖 Mathematical Model

The system is based on a mathematical model with:

**State Evolution**: `dS/dt = f(E, S)`

**Evidence Accumulation**: `E_new = E_old * e^(-λΔt) + ΔE`

**Mass Conservation**: `Σ s_i = M` (constant)

**Blob Boundary**: `B(θ) = Σ s_i · F_i(θ)` where θ ∈ [0, 2π]

For detailed mathematical formulation, see `misir_mathmatical_model_doc.md`.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

Built with Next.js, Supabase, shadcn/ui, and PixiJS.
