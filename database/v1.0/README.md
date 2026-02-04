# Misir Database Schema v1.0

> ⚠️ **This documentation is for v1.0.**  
> For the latest version, see [`/database/latest`](../latest/).

---

## Overview

v1.0 is the production-ready foundation with:
- 12 tables
- 6 enums
- 8 RPC functions
- 5 triggers

## Files

| File | Description |
|------|-------------|
| [`schema.sql`](schema.sql) | Full schema DDL |
| [`security-fixes.sql`](security-fixes.sql) | Search path security fixes |
| [`SECURITY-FIXES.md`](SECURITY-FIXES.md) | Security documentation |
| [`DOCUMENTATION.md`](DOCUMENTATION.md) | Complete schema documentation |

## Upgrade Path

To upgrade to v1.1:
```bash
psql misir -f ../v1.1/migration.sql
```

See [`v1.1/README.md`](../v1.1/README.md) for v1.1 changes.
