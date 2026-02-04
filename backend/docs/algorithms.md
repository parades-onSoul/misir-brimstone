# Algorithm Reference

> For complete specification, see [`algorithm-spec.md`](algorithm-spec.md)

---

## Overview

Misir implements four core algorithm primitives:

| Algorithm | Purpose |
|-----------|---------|
| **OSCL** | Online Semantic Centroid Learning |
| **WESA** | Weighted Engagement Signal Accumulation |
| **SDD** | Semantic Drift Detection |
| **ISS** | Implicit Semantic Search |

Plus one critical invariant:
- **Assignment Margin** — Prevents centroid pollution

---

## 1. OSCL — Online Semantic Centroid Learning

**Formula:**
```
Cₜ = (1 - α) × Cₜ₋₁ + α × xₜ
```

**Purpose:** Incrementally update subspace centroids as signals arrive.

**Parameters:**
| Parameter | Default | Source |
|-----------|---------|--------|
| `learning_rate` (α) | 0.1 | `subspace.learning_rate` |
| `min_signals` | 5 | config |

---

## 2. WESA — Weighted Engagement Signal Accumulation

**Formula:**
```
effective_weight = base_weight × relevance × decay × reliability
```

**Engagement Hierarchy:**
| Level | Weight |
|-------|--------|
| `latent` | 0.25 |
| `discovered` | 0.50 |
| `engaged` | 0.75 |
| `saturated` | 1.00 |

**v1.0 Invariant:** `learning_rate` is independent of `effective_weight`.

---

## 3. SDD — Semantic Drift Detection

**Formulas:**
```
drift = 1 - cos(Cₜ, Cₜ₋₁)
displacement = Cₜ - Cₜ₋₁              // vector
speed = ‖displacement‖ / Δt           // scalar
```

**Thresholds:**
| Drift | Action |
|-------|--------|
| < 0.02 | Ignore |
| 0.02 - 0.10 | Log to history |
| > 0.10 | Emit insight |
| > 0.05 sustained | Consider split |

---

## 4. ISS — Implicit Semantic Search

**Index:** HNSW (Hierarchical Navigable Small World)

| Parameter | Value |
|-----------|-------|
| `m` | 16 |
| `ef_construction` | 128 |
| `ef_search` | 40 |

**Operator:** `<=>` uses cosine distance on L2-normalized vectors.

**Matryoshka Dimensions:**
| Dim | Quality | Use |
|-----|---------|-----|
| 768 | 100% | Storage, centroids |
| 384 | ~98% | Extension |
| 256 | ~96% | Fast local |

---

## 5. Assignment Margin

**Formula:**
```
margin = d₂ − d₁
```

**Rule:** If `margin < 0.1`, signal does NOT update centroid.

**Why:** Prevents ambiguous signals from polluting centroids at scale.

**Config:** `assignment_margin_threshold` in `system_config`

---

## Implementation Locations

| Algorithm | DB Location | Backend Location |
|-----------|-------------|------------------|
| OSCL | `update_subspace_centroid()` trigger | — |
| WESA | RPC validation | — |
| SDD | Trigger drift calculation | — |
| ISS | HNSW index on `signal.vector` | — |
| Margin | Trigger skip logic | `margin_service.py` |
