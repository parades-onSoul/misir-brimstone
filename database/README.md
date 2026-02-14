# Misir Database

Current recommended entry point:
- `database/latest/README.md`

Current latest migration set:
- Base: `v1.0`
- Upgrades: `v1.1` -> `v1.2` -> `v1.3` -> `v1.4` -> `v1.5`

## Quick Start (fresh install)

```bash
psql misir -f v1.0/schema.sql
psql misir -f v1.0/security-fixes.sql
psql misir -f v1.1/migration.sql
psql misir -f v1.2/migration.sql
psql misir -f v1.3/migration.sql
psql misir -f v1.4/migration.sql
psql misir -f v1.5/matryoshka-search-migration.sql
psql misir -f v1.5/sensitivity-tuning.sql
```

## Version docs

- `v1.0/README.md`
- `v1.1/README.md`
- `v1.2/README.md`
- `v1.3/README.md`
- `v1.4/README.md`
- `v1.5/README.md`
- `latest/README.md`
