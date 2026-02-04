# Misir Algorithm Specification v1.0

> **Version:** 1.0 — shiro.exe  
> **Date:** February 2026  
> **System Identity:** A streaming semantic memory system with implicit feedback learning

---

## Overview

Misir implements a **real-time knowledge learning system** built on four named algorithm primitives. These algorithms operate on implicit signals from user behavior to incrementally learn semantic representations of knowledge spaces.

---

## 1️⃣ OSCL — Online Semantic Centroid Learning

**Purpose:** Incrementally update the semantic center (centroid) of a subspace as new signals arrive.

### Mathematical Foundation

```
Cₜ = (1 - α) × Cₜ₋₁ + α × xₜ
```

Where:
- `Cₜ` = New centroid at time t
- `Cₜ₋₁` = Previous centroid
- `xₜ` = New signal vector
- `α` = Learning rate (default: 0.1, configurable per-subspace)

### Variants

| Variant | Formula | Use Case |
|---------|---------|----------|
| **Single Signal EMA** | `(1-α)C + αx` | Per-signal updates |
| **Batch Weighted** | `Σ(xᵢ × wᵢ) / Σ(wᵢ)` | Batch aggregation |

### Implementation

```python
# Temporal learning (when)
new_centroid = (1 - learning_rate) * old_centroid + (learning_rate * signal.vector)

# Spatial aggregation (how)  
batch_centroid = np.average(vectors, axis=0, weights=magnitudes)
```

### Parameters

| Parameter | Default | Source | Description |
|-----------|---------|--------|-------------|
| `learning_rate` | 0.1 | `subspace.learning_rate` | Per-subspace adaptivity |
| `min_signals` | 5 | config | Minimum before stable centroid |

### Triggers

- **On Signal Insert:** `update_subspace_centroid()` trigger
- **History Logging:** When semantic distance ≥ 0.05 from last log

---

## 2️⃣ WESA — Weighted Engagement Signal Accumulation

**Purpose:** Weight signals by user engagement to prioritize high-quality learning inputs.

### Mathematical Foundation

```
effective_weight = base_weight × relevance × decay_factor × reliability
```

Where:
- `base_weight` = Initial signal magnitude (0.0 - 1.0)
- `relevance` = Contextual match to subspace (0.0 - 1.0)
- `decay_factor` = Time-based decay: `e^(-λt)`
- `reliability` = Source trustworthiness (future)

### Engagement Hierarchy

| Level | Weight Multiplier | Behavior |
|-------|-------------------|----------|
| `latent` | 0.25 | Passive exposure |
| `discovered` | 0.50 | Active awareness |
| `engaged` | 0.75 | Intentional interaction |
| `saturated` | 1.00 | Deep immersion |

### Semantic Ordering

Engagement levels have **semantic ordering** — never downgrade:
```sql
CASE WHEN new_level > old_level THEN new_level ELSE old_level END
```

### Implementation

```python
# Reading depth (client-computed, DB-validated)
reading_depth = (time_ratio * 0.6) + (scroll_depth * 0.4)

# Effective weight
effective_weight = magnitude * engagement_multiplier * decay
```

### 🔒 v1.0 Invariant: OSCL × WESA Independence

> **In v1.0, `learning_rate` (α) is independent of `effective_weight`.**
> 
> `effective_weight` affects *whether* and *how strongly* a signal is applied,  
> but does **not** modify the base learning rate.
>
> Future versions may introduce adaptive α = base_α × effective_weight.

---

## 3️⃣ SDD — Semantic Drift & Dynamics Detection

**Purpose:** Track centroid movement over time to detect topic evolution, concept drift, and knowledge shifts.

### Mathematical Foundation

```
drift = 1 - cos(Cₜ, Cₜ₋₁)
displacement = Cₜ - Cₜ₋₁           # Vector quantity
speed = ‖displacement‖ / Δt        # Scalar quantity
acceleration = Δspeed / Δt         # Future
```

Where:
- `cos(a, b)` = Cosine similarity
- `Δt` = Time between states

### Terminology

| Term | Type | Definition |
|------|------|------------|
| **drift** | scalar | Cosine distance: `1 - cos(Cₜ, Cₜ₋₁)` |
| **displacement** | vector | `Cₜ - Cₜ₋₁` |
| **speed** | scalar | `‖displacement‖ / Δt` |

### Dispersion (Signal Spread)

```
dispersion = Σ(‖xᵢ - C‖ × wᵢ) / Σ(wᵢ)
```

Low dispersion = coherent subspace  
High dispersion = may need splitting

### Drift Thresholds

| Threshold | Value | Action |
|-----------|-------|--------|
| Minimal drift | < 0.02 | No action |
| Moderate drift | 0.02 - 0.10 | Log to history |
| Significant drift | > 0.10 | Emit insight |
| Sustained drift | > 0.05 for 5+ signals | Consider split |

### Implementation

```python
# Cosine distance (already in DB trigger)
drift = 1 - (new_centroid <=> old_centroid)

# Displacement and speed
displacement = new_centroid - old_centroid  # Vector
speed = np.linalg.norm(displacement) / time_delta  # Scalar
```

### History Logging Criteria

Log centroid to history when:
```
distance_moved >= 0.05 OR signals_since_last_log >= 5
```

---

## 4️⃣ ISS — Implicit Semantic Search

**Purpose:** Fast approximate nearest-neighbor search over high-dimensional embeddings.

### Mathematical Foundation

```
similarity = cos(query, candidate) = (q · c) / (‖q‖ × ‖c‖)
```

### Index Structure

**HNSW (Hierarchical Navigable Small World)**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `m` | 16 | Max connections per node |
| `ef_construction` | 128 | Index build quality |
| `ef_search` | 40 | Query-time quality/speed |

### 🔍 Operator Clarification

> **The `<=>` operator uses cosine distance on L2-normalized vectors.**
>
> Postgres pgvector supports L2, inner product, and cosine. Misir uses cosine.

### Matryoshka Dimensionality

Nomic Embed v1.5 supports truncation with minimal quality loss:

| Dimension | Quality | Use Case |
|-----------|---------|----------|
| 768 | 100% | DB storage, centroid calculation |
| 512 | ~99% | Fast similarity search |
| 384 | ~98% | Extension-compatible |
| 256 | ~96% | Ultra-fast local matching |

### Implementation

```python
# Truncation with re-normalization
truncated = embedding[:dim]
normalized = truncated / np.linalg.norm(truncated)
```

```sql
-- Vector search (PostgreSQL, cosine distance)
SELECT * FROM signal
ORDER BY vector <=> query_vector
LIMIT 20;
```

---

## 🔐 Assignment Margin Invariant (CRITICAL)

> **Status:** ✅ IMPLEMENTED in v1.1 migration  
> **Files:** `database/v1.1-assignment-margin-migration.sql`, `infrastructure/services/margin_service.py`

> **This is the #1 rule that prevents centroid pollution at scale.**

### Definition

When assigning a signal to a subspace:

```
margin = d₂ − d₁
```

Where:
- `d₁` = distance to nearest centroid
- `d₂` = distance to second-nearest centroid

### Rule

If `margin < margin_threshold` (default: 0.1):
- Signal **does NOT** update the centroid
- Signal is logged as **ambiguous**
- Signal may contribute to **markers only**

### Why This Matters

| Problem | Solution via Margin |
|---------|---------------------|
| Mixed topics drift centroid | Low-margin signals don't update |
| Subspace boundaries blur | Coherence preserved |
| Splitting becomes urgent | Splitting becomes optional |

### Configuration

```json
{
  "key": "assignment_margin_threshold",
  "value": 0.1,
  "description": "Minimum margin for centroid updates"
}
```

---

## Algorithm Interactions

```
┌─────────────────────────────────────────────────────────┐
│                    Signal Arrives                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           WESA: Compute effective_weight                 │
│      (engagement × magnitude × decay × reliability)      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│     🔐 Assignment Margin Check                           │
│     If margin < threshold → skip centroid update         │
└────────────────────────┬────────────────────────────────┘
                         │ (if margin OK)
                         ▼
┌─────────────────────────────────────────────────────────┐
│         OSCL: Update centroid with weighted signal       │
│              Cₜ = (1-α)Cₜ₋₁ + α × xₜ                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           SDD: Compute drift from old centroid           │
│      If drift ≥ threshold → log history, emit insight    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│          ISS: Index updated for fast retrieval           │
│                HNSW automatically updated                │
└─────────────────────────────────────────────────────────┘
```

---

## Subspace Lifecycle States

| State | Meaning | Transition Trigger |
|-------|---------|-------------------|
| `active` | Receiving signals | New subspace or resumed activity |
| `stable` | Low drift, coherent | drift < 0.02 sustained |
| `drifting` | Sustained moderate drift | drift > 0.05 for 5+ signals |
| `dormant` | Below forgetting threshold | No signals for T time |
| `retired` | No longer updated | Manual or automatic retirement |

---

## Design Principles

1. **DB is Arbiter** — Backend validates shape, DB enforces constraints
2. **Fail Soft** — Config cache uses defaults on error, never blocks
3. **Command-Shaped Writes** — No generic `.save()`, only intentional commands
4. **Semantic Ordering** — Engagement levels never downgrade
5. **Config-Driven** — All tunable parameters in `system_config`
6. **Deterministic** — Given identical signal order, Misir is deterministic
7. **Replayable** — Signals are append-only and replayable to reconstruct all derived state

---

## Configuration (system_config)

| Key | Value | Description |
|-----|-------|-------------|
| `embedding_model` | `{name, dimension: 768}` | Current embedding model |
| `reading_depth_constants` | `{avg_wpm: 200, ...}` | Formula parameters |
| `centroid_history_threshold` | `{distance: 0.05, min_signals: 5}` | History logging rules |
| `vector_index_params` | `{m: 16, ef_construction: 128}` | HNSW parameters |
| `assignment_margin_threshold` | `0.1` | Minimum margin for centroid updates |

---

## Missing Concepts (Roadmap)

| Concept | Description | Priority |
|---------|-------------|----------|
| **Signal Reliability** | Source trustworthiness weighting | Medium |
| **Forgetting Threshold** | Retire subspace if weight < ε for T time | Medium |
| **IIS (Implicit Interest Scoring)** | `Σ effective_weight × type_weight` per subspace | High |
| **Adaptive Learning Rate** | Use effective_weight as α | Low |
| **Subspace Splitting** | Split on sustained high drift/dispersion | Low |

---

## References

- Online k-means clustering
- Exponential Moving Average (EMA)
- HNSW (Malkov & Yashunin, 2016)
- Matryoshka Representation Learning (Kusupati et al., 2022)
- Implicit Feedback Models (Hu et al., 2008)
