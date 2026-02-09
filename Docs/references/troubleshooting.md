# Troubleshooting Guide

Common issues and solutions for Misir.

## Backend Issues

### Import Errors

**Problem**: `ModuleNotFoundError` when running backend

**Solutions**:
```bash
# Ensure virtual environment is activated
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Verify Python path
which python
python -c "import sys; print(sys.path)"

# Reinstall dependencies
pip install -r requirements.txt
```

### Database Connection Issues

**Problem**: `Connection refused` or authentication errors

**Solutions**:
```bash
# Check environment variables
cat backend/.env | grep SUPABASE

# Test connection manually
psql -h <supabase-host> -U postgres -d postgres

# Verify Supabase project status
curl -I https://your-project.supabase.co
```

**Common `.env` mistakes**:
```bash
# ❌ Wrong
SUPABASE_URL=https://your-project.supabase.co/  # Extra slash
SUPABASE_KEY="your-key"                         # Quotes not needed

# ✅ Correct  
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key-without-quotes
```

### Authentication Errors

**Problem**: `401 Authentication required`

**Solutions**:
```bash
# Check JWT token format
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/spaces

# Verify token is valid (not expired)
jwtto decode <your-jwt-token>

# Check Supabase auth settings
# Ensure RLS policies are correct
```

### Embedding Service Errors

**Problem**: `Failed to load model` or embedding errors

**Solutions**:
```python
# Check model loading
from infrastructure.services.embedding_service import EmbeddingService
service = EmbeddingService()
result = service.embed_text("test")

# Clear model cache
rm -rf ~/.cache/huggingface/

# Verify internet connection for model download
ping huggingface.co
```

## Database Issues

### Migration Failures

**Problem**: Migration scripts fail to run

**Solutions**:
```bash
# Check PostgreSQL version
psql --version  # Requires 14+

# Verify pgvector extension
psql misir -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Check database permissions
psql misir -c "\l"  # List databases
psql misir -c "\du" # List users

# Run migrations individually
psql misir -f database/v1.0/schema.sql
# Check for errors before proceeding
```

### Schema Mismatches

**Problem**: Backend/database enum mismatches

**Solutions**:
```sql
-- Check current enums
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'misir.engagement_level'::regtype;

-- Expected values: latent, discovered, engaged, saturated

-- If wrong, apply v1.2 migration
psql misir -f database/v1.2/migration.sql
```

### RLS Policy Issues

**Problem**: Permission denied errors

**Solutions**:
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, cmd, qual 
FROM pg_policies WHERE schemaname = 'misir';

-- Test with service role
SET ROLE service_role;
SELECT * FROM misir.artifact LIMIT 1;

-- Reset role
RESET ROLE;
```

### Vector Index Issues

**Problem**: Slow vector searches

**Solutions**:
```sql
-- Check if HNSW indexes exist
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'artifact' AND indexdef LIKE '%hnsw%';

-- Rebuild indexes if needed
REINDEX INDEX idx_artifact_content_embedding_hnsw;

-- Check index usage
SELECT idx_scan, idx_tup_read FROM pg_stat_user_indexes 
WHERE indexrelname = 'idx_artifact_content_embedding_hnsw';
```

## Performance Issues

### Slow API Responses

**Problem**: High response times

**Diagnosis**:
```bash
# Check metrics endpoint
curl http://localhost:8000/metrics | grep misir_request_duration

# Profile with time
time curl -X POST http://localhost:8000/api/v1/artifacts/capture \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{...}'

# Check logs for slow queries
tail -f backend/logs/app.log | grep -i "slow"
```

**Solutions**:
- Ensure database indexes are present
- Check for N+1 query problems
- Use async repository methods
- Optimize embedding service caching

### Memory Issues

**Problem**: High memory usage

**Diagnosis**:
```bash
# Monitor memory usage
top -p $(pgrep -f uvicorn)

# Python memory profiling
pip install memory-profiler
@profile
def your_function():
    pass
```

**Solutions**:
- Reduce embedding cache size
- Use pagination for large queries
- Implement proper connection pooling
- Clear unused model caches

## Development Issues

### Test Failures

**Problem**: Tests failing unexpectedly

**Solutions**:
```bash
# Run tests with verbose output
pytest -v tests/

# Run specific failing test
pytest tests/test_specific.py::test_function -v

# Check test database
psql misir_test -c "SELECT COUNT(*) FROM misir.artifact;"

# Reset test database
dropdb misir_test && createdb misir_test
./scripts/database/migrate.sh misir_test latest
```

### Hot Reload Issues

**Problem**: FastAPI not reloading on changes

**Solutions**:
```bash
# Check file watching
uvicorn main:app --reload --reload-dir . --reload-exclude="*.pyc"

# Restart development server
kill $(pgrep -f uvicorn)
uvicorn main:app --reload

# Check for syntax errors
python -m py_compile main.py
```

## Configuration Issues

### Environment Variables

**Problem**: Configuration not loading

**Solutions**:
```bash
# Print all env vars
env | grep SUPABASE

# Check .env file format
cat backend/.env | head -5
# Should not have spaces around =
# Should not have quotes unless needed

# Verify Pydantic settings
python -c "from core.config import settings; print(settings.SUPABASE_URL)"
```

### System Config Issues

**Problem**: Database configuration missing

**Solutions**:
```sql
-- Check system config
SELECT key, value FROM misir.system_config;

-- Insert missing config
INSERT INTO misir.system_config (key, value, description) VALUES (
    'embedding_model',
    '{"name": "nomic-ai/nomic-embed-text-v1.5", "dimension": 768}',
    'Current embedding model'
);
```

## Production Issues

### Health Check Failures

**Problem**: `/health` endpoint returns errors

**Solutions**:
```bash
# Check service status
sudo systemctl status misir-backend

# Check logs
journalctl -u misir-backend -f

# Test database connection
psql misir -c "SELECT 1;"

# Verify port availability
netstat -tlnp | grep 8000
```

### Webhook Delivery Issues

**Problem**: Webhooks not being delivered

**Solutions**:
```sql
-- Check webhook events
SELECT status, COUNT(*) FROM misir.webhook_event 
GROUP BY status;

-- Check failed events
SELECT id, event_type, status, attempts, last_attempt_at 
FROM misir.webhook_event 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Retry failed events
UPDATE misir.webhook_event 
SET status = 'pending', attempts = 0 
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour';
```

## Getting Help

### Debug Information Collection

When reporting issues, collect:

```bash
# System info
python --version
psql --version
uname -a

# Backend status
curl http://localhost:8000/health

# Database status  
psql misir -c "SELECT version();"
psql misir -c "SELECT COUNT(*) FROM misir.artifact;"

# Recent logs
tail -n 50 backend/logs/app.log
```

### Support Channels

1. **Documentation**: Check docs/ folder first
2. **GitHub Issues**: Create detailed issue reports
3. **Development Team**: For complex problems

### Creating Bug Reports

Include:
- **Environment**: OS, Python version, database version
- **Steps to Reproduce**: Exact commands/requests
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Logs**: Relevant error messages
- **Configuration**: Sanitized config (no secrets)

This troubleshooting guide helps resolve most common issues in Misir development and production environments.