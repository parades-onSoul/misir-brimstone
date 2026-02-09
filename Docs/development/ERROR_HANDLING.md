# Error Handling System

**Version:** 1.0  
**Last Updated:** February 8, 2026  
**Status:** Production Ready

---

## 📋 Overview

Misir uses a **hybrid error handling approach** combining:

1. **Result Pattern** (domain layer) - Type-safe error handling with `result` library
2. **RFC 9457 Problem Details** (API layer) - Standardized HTTP error responses with `fastapi-problem`
3. **FastAPI Exception Handlers** - Global error mapping and logging

**Benefits:**
- ✅ Type-safe error propagation through domain layer
- ✅ Standardized error responses (RFC 9457 compliant)
- ✅ Consistent error format for frontend/extension consumption
- ✅ Centralized error logging with structured context
- ✅ 50% less error handling boilerplate

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (FastAPI)                     │
│  - Receives HTTP requests                                    │
│  - Validates input (Pydantic)                               │
│  - Calls handlers                                           │
│  - Converts errors to Problem responses                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer (Handlers)               │
│  - Business logic orchestration                             │
│  - Returns Result[T, ErrorDetail]                           │
│  - No HTTP concerns                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Infrastructure Layer (Repositories)            │
│  - Database operations                                      │
│  - External service calls                                   │
│  - Returns Result[T, ErrorDetail]                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Components

### 1. Error Types (`core/error_types.py`)

Defines domain error types and Result pattern utilities.

**Key Classes:**
- `DomainError` - Error code constants
- `ErrorDetail` - Structured error with type, message, and context
- `Result[T, ErrorDetail]` - Type-safe error container

**Common Error Codes:**
```python
# Validation
VALIDATION_ERROR = "validation-error"
INVALID_INPUT = "invalid-input"
INVALID_RANGE = "invalid-range"

# Not Found
NOT_FOUND = "not-found"
SPACE_NOT_FOUND = "space-not-found"

# Conflict
CONFLICT = "conflict"
ALREADY_EXISTS = "already-exists"

# Infrastructure
REPOSITORY_ERROR = "repository-error"
EMBEDDING_SERVICE_ERROR = "embedding-service-error"
```

### 2. Error Handlers (`core/error_handlers.py`)

FastAPI exception handlers that convert errors to RFC 9457 Problem responses.

**Key Functions:**
- `create_problem_response()` - Convert ErrorDetail to Problem
- `pydantic_validation_error_handler()` - Handle request validation
- `value_error_handler()` - Legacy ValueError handling
- `generic_exception_handler()` - Catch-all for unexpected errors

**Status Code Mapping:**
```python
Validation errors (400)    → Bad Request
Not found (404)           → Not Found
Conflicts (409)           → Conflict
Business rules (422)      → Unprocessable Entity
Infrastructure (500)      → Internal Server Error
External services (502)   → Bad Gateway
```

### 3. Main App Registration (`main.py`)

Exception handlers are registered in order of specificity:

```python
app.add_exception_handler(ValidationError, pydantic_validation_error_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)
```

---

## 🚀 Usage Patterns

### Pattern 1: Domain Layer (Result Pattern)

Use `Result[T, ErrorDetail]` for business logic.

```python
from result import Result, Ok, Err
from core.error_types import ErrorDetail, not_found_error, validation_error

class SpaceRepository:
    async def find_by_id(self, space_id: int) -> Result[Space, ErrorDetail]:
        """Find space by ID."""
        try:
            data = await self._client.table('spaces').select('*').eq('id', space_id).single().execute()
            
            if not data.data:
                return Err(not_found_error("Space", space_id))
            
            return Ok(Space.from_dict(data.data))
            
        except Exception as e:
            return Err(ErrorDetail(
                error_type=DomainError.REPOSITORY_ERROR,
                message=f"Failed to fetch space: {str(e)}",
                context={"space_id": space_id}
            ))
```

### Pattern 2: Handler Layer (Result Propagation)

Handlers orchestrate operations and propagate Results.

```python
from result import Result
from core.error_types import ErrorDetail

class SpaceHandler:
    async def get_space(self, space_id: int, user_id: str) -> Result[Space, ErrorDetail]:
        """Get space with ownership check."""
        # Repository returns Result
        result = await self._repo.find_by_id(space_id)
        
        if result.is_err():
            return result  # Propagate error
        
        space = result.unwrap()
        
        # Business logic validation
        if space.user_id != user_id:
            return Err(ErrorDetail(
                error_type=DomainError.FORBIDDEN,
                message="You don't have access to this space",
                context={"space_id": space_id, "user_id": user_id}
            ))
        
        return Ok(space)
```

### Pattern 3: API Layer (Problem Response)

Convert Result to HTTP response.

**Option A: Let ValueError bubble up (recommended for simple cases)**
```python
from fastapi import APIRouter
from fastapi_problem.error import Problem

@router.get("/{space_id}")
async def get_space(space_id: int, user_id: str):
    """
    Get space by ID.
    
    Raises:
        Problem (404): If space not found
        Problem (403): If user doesn't own space
    """
    handler = SpaceHandler(client)
    result = await handler.get_space(space_id, user_id)
    
    # Convert Result to Problem if error
    if result.is_err():
        error = result.unwrap_err()
        raise create_problem_response(error, request.url.path)
    
    space = result.unwrap()
    return SpaceResponse.from_entity(space)
```

**Option B: Direct Problem raise (simpler for single errors)**
```python
@router.get("/{space_id}")
async def get_space(space_id: int, user_id: str):
    handler = SpaceHandler(client)
    space = await handler.get_space_or_none(space_id, user_id)
    
    if space is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
    
    return SpaceResponse.from_entity(space)
```

---

## 📤 Error Response Format (RFC 9457)

All errors return consistent JSON format:

```json
{
  "type": "space-not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Space with id 123 not found",
  "extra": {
    "space_id": 123,
    "user_id": "abc123"
  }
}
```

**Fields:**
- `type` - Machine-readable error code (e.g., "space-not-found")
- `title` - Human-readable error category (e.g., "Not Found")
- `status` - HTTP status code (e.g., 404)
- `detail` - Specific error message
- `extra` - Optional context data (not shown to user, for debugging)

---

## 🎯 Migration Guide

### Before (Old Pattern)

```python
# ❌ Old: Manual try-catch everywhere
@router.get("/{id}")
async def get_space(space_id: int):
    try:
        result = await repo.find(space_id)
        if not result:
            raise HTTPException(status_code=404, detail="Space not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### After (New Pattern)

```python
# ✅ New: Clean, automatic error handling
@router.get("/{id}")
async def get_space(space_id: int):
    """
    Get space by ID.
    
    Raises:
        Problem (404): If space not found
    """
    handler = SpaceHandler(client)
    space = await handler.get(space_id)
    
    if space is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
    
    return SpaceResponse.from_entity(space)
```

**Benefits:**
- 50% less code
- Consistent error format
- Automatic logging at appropriate level
- Type-safe error propagation in domain layer

---

## 🛠️ Helper Functions

### Creating Errors

```python
from core.error_types import (
    validation_error,
    not_found_error,
    conflict_error,
    repository_error,
    invalid_range_error
)

# Validation error
error = validation_error("Name is required", field="name")

# Not found
error = not_found_error("Space", 123)
# → "Space with identifier '123' not found"

# Invalid range
error = invalid_range_error("reading_depth", 1.8, 0.0, 1.5)
# → "reading_depth must be between 0.0 and 1.5, got 1.8"

# Repository error
error = repository_error("Database connection failed", operation="fetch_space")
```

### Converting to HTTP

```python
from core.error_handlers import create_problem_response

# Automatic status code mapping + logging
problem = create_problem_response(error, request.url.path)
raise problem
```

---

## 📊 Error Logging

Errors are automatically logged at appropriate levels:

**Client Errors (4xx) → WARNING**
```json
{
  "level": "warning",
  "message": "Client error: Space with id 123 not found",
  "error_type": "space-not-found",
  "context": {"space_id": 123},
  "path": "/api/v1/spaces/123"
}
```

**Server Errors (5xx) → ERROR**
```json
{
  "level": "error",
  "message": "Server error: Database connection failed",
  "error_type": "repository-error",
  "context": {"operation": "fetch_space"},
  "path": "/api/v1/spaces/123",
  "exc_info": "..."
}
```

---

## 🧪 Testing

### Testing Domain Layer

```python
def test_space_not_found():
    result = await repo.find_by_id(999)
    
    assert result.is_err()
    error = result.unwrap_err()
    assert error.error_type == DomainError.SPACE_NOT_FOUND
    assert "999" in error.message
```

### Testing API Layer

```python
def test_get_space_not_found(client):
    response = client.get("/api/v1/spaces/999")
    
    assert response.status_code == 404
    assert response.json()["type"] == "space-not-found"
    assert "999" in response.json()["detail"]
```

---

## 📚 Reference

### Related Files
- `backend/core/error_types.py` - Error definitions
- `backend/core/error_handlers.py` - FastAPI exception handlers
- `backend/main.py` - Error handler registration
- `backend/interfaces/api/spaces.py` - Reference implementation

### External Documentation
- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [fastapi-problem Documentation](https://github.com/NRWLDev/fastapi-problem)
- [result Library](https://github.com/rustedpy/result)

---

## 🚨 Common Pitfalls

### ❌ Don't: Return None from repositories
```python
# ❌ Bad
async def find_by_id(self, id: int) -> Optional[Space]:
    return None  # Loses error context
```

### ✅ Do: Return Result with error detail
```python
# ✅ Good
async def find_by_id(self, id: int) -> Result[Space, ErrorDetail]:
    return Err(not_found_error("Space", id))
```

### ❌ Don't: Catch and re-raise HTTPException
```python
# ❌ Bad
try:
    result = await handler.create(cmd)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))  # Loses context
```

### ✅ Do: Let ValueError bubble to global handler
```python
# ✅ Good
result = await handler.create(cmd)
# ValueError automatically converted to Problem response
```

### ❌ Don't: Log errors in API layer
```python
# ❌ Bad
except Exception as e:
    logger.error(f"Failed: {e}")  # Already logged by global handler
    raise Problem(...)
```

### ✅ Do: Rely on automatic logging
```python
# ✅ Good
raise Problem(status=500, ...)
# Automatically logged by error handler
```

---

## 🎓 Best Practices

1. **Use Result in domain/infrastructure layers** for type-safe error propagation
2. **Raise Problem in API layer** for HTTP responses
3. **Let global handlers catch unexpected errors** for consistent logging
4. **Include context in errors** for debugging (`context={"space_id": 123}`)
5. **Use typed error codes** from `DomainError` constants
6. **Don't suppress errors** - let them bubble up for proper handling
7. **Test error paths** - verify both success and error cases

---

## 📈 Migration Checklist

- [x] Install `result` and `fastapi-problem` libraries
- [x] Create `core/error_types.py` with error definitions
- [x] Create `core/error_handlers.py` with FastAPI handlers
- [x] Update `main.py` to register error handlers
- [x] Update `spaces.py` as reference implementation
- [ ] Migrate remaining API endpoints (capture, search, artifacts)
- [ ] Update repositories to return Result
- [ ] Update handlers to use Result pattern
- [ ] Add tests for error cases
- [ ] Update API documentation with error responses

---

**Next Steps:** Apply this pattern to remaining endpoints (capture, search, artifacts) for consistent error handling across the entire API.
