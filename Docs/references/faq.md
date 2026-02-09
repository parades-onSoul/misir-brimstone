# Frequently Asked Questions

## General Questions

### What is Misir?
Misir is a semantic attention tracking system that helps users understand where they're investing their mental energy. It captures reading behavior and builds knowledge maps using machine learning algorithms.

### What does "Misir" mean?
Misir implements the MISIR algorithm stack: Machine Intelligence for Semantic Information Retrieval. It's also a play on "misère" (difficulty/hardship), representing the challenge of managing information overload.

### What's the current status?
Backend v1.4 is production-ready. Frontend and browser extension are planned for rebuild to match the new architecture.

## Architecture Questions

### Why Domain-Driven Design (DDD)?
DDD provides:
- Clear separation of business logic from infrastructure
- Testable, maintainable code structure  
- Scalable architecture for complex domains
- Common language between developers and domain experts

### Why PostgreSQL instead of a vector database?
PostgreSQL with pgvector provides:
- **Mature ecosystem**: Proven reliability and tooling
- **ACID compliance**: Strong consistency guarantees
- **Rich features**: Complex queries, triggers, RLS
- **Cost-effective**: No additional database to maintain
- **Performance**: HNSW indexes provide excellent vector search performance

### What are the core algorithms?

1. **OSCL (Online Semantic Centroid Learning)**: Updates knowledge cluster centers incrementally
2. **WESA (Weighted Engagement Signal Accumulation)**: Weights signals by reading engagement 
3. **SDD (Semantic Drift Detection)**: Tracks how knowledge domains evolve
4. **ISS (Implicit Semantic Search)**: Fast vector similarity search

## Technical Questions

### What embedding model do you use?
**Nomic AI Embed v1.5** (768 dimensions)
- 8192 token context length
- Designed for retrieval tasks
- Good performance on diverse content
- Supports Matryoshka truncation

### Why 768 dimensions?
Optimal balance between:
- **Quality**: Sufficient semantic richness
- **Performance**: Fast search and storage
- **Compatibility**: Standard model size
- **Memory**: Reasonable memory usage

### How do you handle embedding model changes?
Each signal tracks its embedding model and dimension:
- New signals use current model
- Old signals keep their original model
- Gradual migration during search/updates
- No forced re-embedding required

### What's the assignment margin?
The assignment margin (v1.1) prevents centroid pollution:
- Calculates distance to 2 closest centroids
- Only updates centroid if margin > threshold
- Maintains cluster quality with ambiguous signals
- Default threshold: 0.1

## Development Questions

### How do I add a new API endpoint?

1. **Define command** in `domain/commands/`
2. **Create handler** in `application/handlers/`
3. **Add repository method** if needed
4. **Create API route** in `interfaces/api/`
5. **Add tests** in `tests/`

### How do I modify the database schema?

1. **Create version folder**: `database/vX.Y/`
2. **Write migration**: `migration.sql`
3. **Document changes**: `README.md`
4. **Update domain models** in backend
5. **Test migration** thoroughly
6. **Update migration script**

### How do I add a new engagement level?

1. **Update enum** in `domain/value_objects/types.py`
2. **Create database migration** to add enum value
3. **Update RPC functions** for semantic ordering
4. **Update validation** logic
5. **Add tests** for new level

### Why async repositories if using sync Supabase client?
In v1.4, we wrap synchronous calls with `run_in_executor()` to prevent blocking the event loop. Future versions may use async Supabase client.

## Database Questions

### Why Supabase over raw PostgreSQL?
Supabase provides:
- **Row Level Security**: Built-in user isolation
- **Real-time subscriptions**: For future features
- **Admin dashboard**: Easy database management
- **Authentication**: JWT token validation
- **Edge functions**: For serverless operations

### How does Row Level Security work?
RLS policies ensure users only access their own data:
```sql
CREATE POLICY "Users can manage own artifacts"
ON misir.artifact
FOR ALL
USING (auth.uid() = user_id);
```

### What's the difference between artifacts and signals?
- **Artifacts**: Captured content (articles, videos, etc.)
- **Signals**: Vector representations with engagement metadata
- One artifact can generate multiple signals over time
- Signals are append-only, artifacts can be updated

### How do you handle URL deduplication?
- URLs are normalized (tracking parameters removed)
- One artifact per normalized URL per user
- Conflicts update engagement metrics (never downgrade)
- Domain extracted automatically for analytics

## Performance Questions

### How fast is vector search?
- **Sub-50ms** for most queries with HNSW index
- **~95% recall** with proper index parameters
- **Scales to millions** of vectors
- **Memory efficient** with disk-based storage

### What's the embedding cache performance?
- **LRU cache** with 10,000 items by default
- **Thread-safe** access with locks
- **Hash-based** deduplication
- **Configurable** cache size

### How do you handle high write volumes?
- **Async processing** prevents blocking
- **Batch endpoints** for bulk operations
- **Database connection pooling**
- **Webhook queuing** with retry logic

## Deployment Questions

### What are the system requirements?
- **Python 3.10+**
- **PostgreSQL 14+** with pgvector
- **2GB RAM** minimum (4GB recommended)
- **SSD storage** for vector indexes
- **Internet access** for embedding models

### How do you deploy to production?

1. **Database migration**: Apply all schema changes
2. **Environment setup**: Configure production .env
3. **Service deployment**: Use systemd or Docker
4. **Health verification**: Check /health endpoint
5. **Monitoring setup**: Configure metrics collection

### What monitoring do you recommend?
- **Prometheus** for metrics collection
- **Grafana** for dashboards
- **Log aggregation** (ELK stack or similar)
- **Uptime monitoring** for health checks
- **Database monitoring** for query performance

### How do you handle secrets?
- **Environment variables** for configuration
- **No secrets in code** or version control
- **Separate configs** per environment
- **Vault systems** for production secrets

## Future Questions

### What's planned for the frontend?
Complete rebuild with:
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Real-time updates** via Supabase
- **Interactive visualizations** of knowledge spaces

### What about the browser extension?
New extension will feature:
- **Passive capture** of reading behavior
- **Smart notifications** based on semantic similarity
- **Privacy-focused** data handling
- **Cross-browser compatibility**
- **Offline capability** with sync

### Will you support other embedding models?
Yes, planned features:
- **Multi-model support** with automatic migration
- **Custom model fine-tuning** for specific domains
- **Model comparison** tools
- **Automatic model updates** when available

### What about mobile apps?
Mobile strategy:
- **Progressive Web App** (PWA) first
- **Native apps** if demand justifies development
- **Reading capture** from mobile browsers
- **Sync across devices**

## Troubleshooting

### Common startup issues?
1. **Virtual environment**: Ensure Python venv is activated
2. **Dependencies**: Run `pip install -r requirements.txt`
3. **Database**: Verify PostgreSQL connection
4. **Configuration**: Check `.env` file format
5. **Migrations**: Apply all database migrations

### How to debug authentication issues?
1. **Check JWT token** format and expiration
2. **Verify Supabase** project configuration
3. **Test with curl** to isolate frontend issues
4. **Check RLS policies** in database
5. **Examine server logs** for auth errors

### Vector search returning no results?
1. **Check index creation**: Ensure HNSW indexes exist
2. **Verify embedding dimensions**: Must be 768
3. **Test similarity threshold**: Lower to 0.5 for testing
4. **Check user isolation**: RLS may filter results
5. **Examine query vector**: Ensure proper normalization

## Contributing

### How can I contribute?
1. **Read documentation**: Understand the architecture
2. **Set up development**: Follow setup guide
3. **Find issues**: Check GitHub issues or create new ones
4. **Submit PRs**: Follow the contribution guidelines
5. **Write tests**: Ensure code coverage

### What's the code review process?
1. **Automated checks**: Tests, linting, type checking
2. **Architecture review**: Follows DDD principles
3. **Performance check**: No significant regressions
4. **Documentation**: Updated for new features
5. **Security review**: No vulnerabilities introduced

This FAQ covers the most common questions about Misir. For more specific technical questions, check the detailed documentation or create an issue on GitHub.