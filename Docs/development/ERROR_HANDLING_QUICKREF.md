# Error Handling Quick Reference

## 🚀 Quick Start

### 1. Domain/Repository Layer - Return Result

```python
from result import Result, Ok, Err
from core.error_types import ErrorDetail, not_found_error, repository_error

async def find_space(space_id: int) -> Result[Space, ErrorDetail]:
    try:
        data = await db.fetch(space_id)
        if not data:
            return Err(not_found_error("Space", space_id))
        return Ok(Space.from_dict(data))
    except Exception as e:
        return Err(repository_error(f"Failed to fetch: {e}"))
```

### 2. Handler Layer - Propagate Result

```python
async def get_space(space_id: int) -> Result[Space, ErrorDetail]:
    result = await self._repo.find_space(space_id)
    
    if result.is_err():
        return result  # Propagate error
    
    space = result.unwrap()
    # ... business logic
    return Ok(space)
```

### 3. API Layer - Raise Problem

```python
from fastapi_problem.error import Problem

@router.get("/{space_id}")
async def get_space_endpoint(space_id: int):
    space = await handler.get_space_or_none(space_id)
    
    if space is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space {space_id} not found",
            type_="space-not-found"
        )
    
    return SpaceResponse.from_entity(space)
```

---

## 📦 Common Error Constructors

```python
from core.error_types import (
    validation_error,
    not_found_error,
    conflict_error,
    repository_error,
    invalid_range_error
)

# Validation
validation_error("Name required", field="name")

# Not found
not_found_error("Space", 123)

# Conflict
conflict_error("Space already exists", name="my-space")

# Invalid range
invalid_range_error("score", 105, 0, 100)

# Repository/Infrastructure
repository_error("DB connection failed", operation="insert")
```

---

## 🎯 Error Response Format

```json
{
  "type": "space-not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Space with id 123 not found",
  "extra": {
    "space_id": 123
  }
}
```

---

## 📋 Error Code Reference

| Code | Status | Use When |
|------|--------|----------|
| `validation-error` | 400 | Input validation failed |
| `invalid-input` | 400 | Bad request data |
| `invalid-range` | 400 | Value out of range |
| `unauthorized` | 401 | No valid auth token |
| `forbidden` | 403 | User lacks permission |
| `not-found` | 404 | Resource doesn't exist |
| `space-not-found` | 404 | Specific: Space not found |
| `artifact-not-found` | 404 | Specific: Artifact not found |
| `conflict` | 409 | Resource already exists |
| `business-rule-violation` | 422 | Business logic violation |
| `repository-error` | 500 | Database error |
| `embedding-service-error` | 500 | ML service failure |
| `external-service-error` | 502 | Third-party API failed |

---

## ✅ Best Practices

1. **Domain Layer** → Return `Result[T, ErrorDetail]`
2. **API Layer** → Raise `Problem` 
3. **Let errors bubble** → Global handlers catch unexpected errors
4. **Add context** → `context={"artifact_id": 123}`
5. **Use typed errors** → `DomainError.SPACE_NOT_FOUND`
6. **Don't log in API** → Global handler logs automatically

---

## 🚫 Anti-Patterns

```python
# ❌ Don't return None
def find(id: int) -> Optional[Space]:
    return None

# ✅ Do return Result
def find(id: int) -> Result[Space, ErrorDetail]:
    return Err(not_found_error("Space", id))

# ❌ Don't catch and wrap unnecessarily
try:
    space = await handler.get(id)
except ValueError as e:
    raise HTTPException(400, str(e))

# ✅ Do let it bubble to global handler
space = await handler.get(id)  # ValueError auto-handled

# ❌ Don't log errors in API layer
except Exception as e:
    logger.error(f"Failed: {e}")  # Already logged
    raise Problem(...)

# ✅ Do just raise Problem
raise Problem(status=500, ...)  # Auto-logged
```

---

## 🧪 Testing

```python
# Test domain layer
def test_not_found():
    result = await repo.find(999)
    assert result.is_err()
    assert result.unwrap_err().error_type == DomainError.NOT_FOUND

# Test API layer
def test_api_not_found(client):
    response = client.get("/spaces/999")
    assert response.status_code == 404
    assert response.json()["type"] == "space-not-found"
```

---

## 📚 Full Documentation

See [ERROR_HANDLING.md](./ERROR_HANDLING.md) for complete guide.
