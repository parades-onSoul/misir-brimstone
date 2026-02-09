# Development Setup

This guide covers setting up a complete development environment for Misir.

## Prerequisites

### Required Software
- **Python 3.10+** - Backend runtime
- **PostgreSQL 14+** - Database with pgvector extension
- **Node.js 18+** - Future frontend development
- **Git** - Version control

### Development Tools
- **VS Code** - Recommended editor with Python extension
- **Docker** (optional) - For containerized development
- **Postman/Insomnia** - API testing

## Backend Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd misir
```

### 2. Python Environment
```bash
# Create virtual environment
python -m venv .venv

# Activate (Linux/Mac)
source .venv/bin/activate

# Activate (Windows)
.venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Install development dependencies
pip install -r requirements-dev.txt  # If available
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
# Required variables:
# SUPABASE_URL=your_supabase_project_url
# SUPABASE_KEY=your_supabase_anon_key
# SUPABASE_SERVICE_KEY=your_service_role_key (optional)
```

### 4. Database Setup
```bash
# Navigate to database directory
cd ../database

# Run migration script
../scripts/database/migrate.sh misir latest

# Or manual setup:
psql misir -f v1.0/schema.sql
psql misir -f v1.0/security-fixes.sql
psql misir -f v1.1/migration.sql
psql misir -f v1.2/migration.sql
psql misir -f v1.3/migration.sql
psql misir -f v1.4/migration.sql
psql misir -f v1.4/rpc-function-fix.sql
```

### 5. Run Backend
```bash
cd ../backend

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Backend available at:
# - API: http://localhost:8000
# - Docs: http://localhost:8000/docs
# - Metrics: http://localhost:8000/metrics
```

## Development Workflow

### Code Organization
```
backend/
├── domain/              # Business logic (pure Python)
├── application/         # Use case handlers  
├── infrastructure/      # External systems
├── interfaces/          # API endpoints
├── core/               # Shared utilities
├── tests/              # Test suite
└── main.py             # FastAPI app
```

### Making Changes

1. **Domain First**: Start with domain entities and value objects
2. **Commands**: Define command DTOs for new operations
3. **Handlers**: Implement business logic in application handlers
4. **Repositories**: Add database operations in infrastructure
5. **APIs**: Expose through interface endpoints
6. **Tests**: Add comprehensive tests

### Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_capture_handler.py

# Run with verbose output
pytest -v
```

### Code Quality

```bash
# Format code
black .

# Sort imports
isort .

# Lint code
flake8 .

# Type checking
mypy .
```

## Database Development

### Creating Migrations

1. **Version Folder**: Create `database/vX.Y/`
2. **Migration File**: Add `migration.sql`
3. **Documentation**: Add `README.md`
4. **Test**: Verify migration works
5. **Update Scripts**: Update migration script

### Testing Database Changes

```bash
# Create test database
createdb misir_test

# Apply migrations
./scripts/database/migrate.sh misir_test latest

# Run database tests
pytest tests/test_database.py
```

### Schema Changes Process

1. **Design**: Document schema changes
2. **Migration**: Write SQL migration
3. **Rollback**: Plan rollback strategy
4. **Code Update**: Update domain models
5. **Test**: Verify all tests pass
6. **Deploy**: Apply to staging first

## IDE Configuration

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
    "python.defaultInterpreterPath": "./.venv/bin/python",
    "python.formatting.provider": "black",
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": true,
    "python.testing.pytestEnabled": true,
    "python.testing.pytestArgs": [
        "tests"
    ],
    "files.exclude": {
        "**/__pycache__": true,
        "**/.pytest_cache": true
    }
}
```

### Recommended Extensions

- Python (Microsoft)
- Pylance (Microsoft) 
- autoDocstring (Nils Werner)
- REST Client (Huachao Mao)
- PostgreSQL (Chris Kolkman)

## Debugging

### Backend Debugging

1. **VS Code Debugger**: Use F5 to start debugging
2. **Logging**: Use structured logging with `logger.info()`
3. **Print Debugging**: Use `breakpoint()` for interactive debugging
4. **API Testing**: Use `/docs` endpoint for interactive testing

### Database Debugging

```bash
# Connect to database
psql misir

# View table structure
\d misir.artifact

# Check recent data
SELECT * FROM misir.artifact ORDER BY created_at DESC LIMIT 5;

# Check system config
SELECT * FROM misir.system_config;
```

## Performance Profiling

### API Performance

```bash
# Install profiling tools
pip install py-spy

# Profile running application
py-spy record -o profile.svg -- python -m uvicorn main:app --reload
```

### Database Performance

```sql
-- Enable query logging
SET log_statement = 'all';
SET log_duration = on;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM misir.artifact WHERE user_id = 'uuid';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE schemaname = 'misir';
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Check Python path and virtual environment
2. **Database Connection**: Verify Supabase credentials
3. **Permission Errors**: Check RLS policies
4. **Vector Operations**: Ensure pgvector extension is installed

### Getting Help

1. **Documentation**: Check docs/ folder
2. **Tests**: Look at test files for usage examples
3. **API Docs**: Use `/docs` endpoint
4. **Database**: Check schema documentation

This setup ensures a productive development environment for contributing to Misir.