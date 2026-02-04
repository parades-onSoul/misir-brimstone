# Misir Database

> **Latest:** [v1.2](latest/) — Enum Alignment  
> **Stable:** [v1.0](v1.0/) — Production Base

---

## Directory Structure

```
database/
├── latest/          → Overview & quick start
│   └── README.md
├── v1.0/            → Production base schema
│   ├── README.md
│   ├── schema.sql
│   ├── security-fixes.sql
│   ├── SECURITY-FIXES.md
│   └── DOCUMENTATION.md
├── v1.1/            → Assignment Margin upgrade
│   ├── README.md
│   └── migration.sql
└── v1.2/            → Enum Alignment (engagement_level + content_source)
    ├── README.md
    └── migration.sql
```

## Quick Start

**Fresh install:**
```bash
psql misir -f v1.0/schema.sql
psql misir -f v1.0/security-fixes.sql
psql misir -f v1.1/migration.sql
psql misir -f v1.2/migration.sql
```

**Upgrade from v1.1:**
```bash
psql misir -f v1.2/migration.sql
```

## Documentation

| Doc | Location |
|-----|----------|
| Latest overview | [`latest/README.md`](latest/README.md) |
| Full v1.0 reference | [`v1.0/DOCUMENTATION.md`](v1.0/DOCUMENTATION.md) |
| v1.1 changes | [`v1.1/README.md`](v1.1/README.md) |
| v1.2 changes | [`v1.2/README.md`](v1.2/README.md) |

