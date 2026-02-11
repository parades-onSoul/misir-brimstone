# Testing & Verification Scripts

This directory contains scripts to verify the MISIR data pipeline is working correctly.

## Scripts

### 1. Database Verification (`verify_database.py`)

Checks which database tables are populated and estimates remaining work.

**Usage:**
```bash
cd backend
python scripts/verify_database.py
```

**Checks:**
- ✅ Insights table (auto-generated alerts)
- ✅ Centroid history (for time-series charts)
- ✅ Engagement level values
- ✅ Drift events
- ✅ Velocity measurements

### 2. Endpoint Testing (`test_endpoints.py`)

Tests all API endpoints to ensure the complete data pipeline works.

**Prerequisites:**
1. Backend server must be running:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. Update `TEST_USER_ID` in the script with a real user ID from Supabase

**Usage:**
```bash
cd backend
python scripts/test_endpoints.py
```

**Tests:**
- ✅ Health check
- ✅ List spaces
- ✅ Global analytics (Job 24)
- ✅ Space artifacts paginated (Job 42)
- ✅ Space alerts (Job 43)
- ✅ Space topology t-SNE (Job 44)
- ✅ Analytics endpoints (Job 45a-d)
- ✅ Subspaces list

## Testing Workflow

1. **Start Backend**
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. **Verify Database** (Optional but recommended)
   ```bash
   python scripts/verify_database.py
   ```

3. **Test Endpoints**
   ```bash
   python scripts/test_endpoints.py
   ```

4. **Start Frontend**
   ```bash
   cd ../frontend
   npm run dev
   ```

5. **Manual Testing**
   - Open http://localhost:3000
   - Login and test all features
   - Check browser console for errors

## Expected Results

### Complete Implementation
- All verification checks should pass
- All endpoint tests should return 200 OK
- Frontend should load without errors

### Partial Implementation
- Some database tables may be empty (drift, velocity)
- This is OK for initial testing
- The system will use fallback/dummy data

## Troubleshooting

### Connection Errors
- **Issue**: `Connection failed`
- **Fix**: Make sure backend is running on port 8000

### 404 Errors
- **Issue**: Endpoint not found
- **Fix**: Check that all routers are registered in `main.py`

### Empty Responses
- **Issue**: Tests pass but return empty data
- **Fix**: Normal for new installations. Capture some artifacts first.

### Authentication Errors
- **Issue**: 401/403 errors
- **Fix**: Ensure `TEST_USER_ID` matches a real user in Supabase
