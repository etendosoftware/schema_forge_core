# 11 -- Production Scalability

Performance analysis, bottleneck identification, and scaling strategies for Schema Forge generated modules running on the Etendo platform.

---

## 1. Current Scale Assessment

| Dimension | Current State |
|-----------|--------------|
| **Target user base** | ERP users: tens to low hundreds of concurrent users |
| **Application server** | Single Tomcat 9 instance (no clustering) |
| **Database** | Single PostgreSQL 14+ instance (no replication) |
| **Frontend** | React 18 SPA, browser-bound (no SSR) |
| **Caching** | Hibernate L1/L2 cache only (no Redis, no CDN) |
| **Load testing** | None performed |
| **Performance baselines** | None established |

This is an internal business application, not a consumer-facing service. Hundreds of concurrent users is the realistic ceiling. Scaling strategies should focus on efficiency and vertical scaling before considering horizontal scaling.

---

## 2. Performance Bottlenecks

### 2.1 Database

| Bottleneck | Cause | Symptoms | Severity |
|-----------|-------|----------|----------|
| **Large HQL queries on high-row tables** | Business tables like `C_OrderLine` or `M_InOutLine` accumulate millions of rows over years | Slow list view loading (>5s), high PostgreSQL CPU | WARNING |
| **Missing indexes on generated query patterns** | Tab where-clauses and filter conditions use columns that may lack indexes | Full table scans, slow WHERE clause evaluation | WARNING |
| **N+1 queries in list endpoints** | RequestHandler loads a list, then resolves FK references one by one | One query per row instead of one query total. Multiplies response time by record count | CRITICAL for large lists |
| **Connection pool sizing** | Default HikariCP pool (10 connections) may be too small for concurrent users | `Connection is not available, request timed out` errors under load | WARNING |
| **PostgreSQL autovacuum on high-write tables** | Tables with frequent INSERT/UPDATE accumulate dead tuples | Query planner uses stale statistics, chooses bad plans, queries slow down gradually | WARNING |

**Mitigation priorities:**
1. Add database indexes for all generated HQL patterns (WHERE, ORDER BY, JOIN conditions)
2. Implement eager fetching or batch loading for FK references in list endpoints
3. Size HikariCP pool to match expected concurrent users (see capacity planning table)
4. Configure autovacuum aggressiveness for high-write tables

### 2.2 Application Server

| Bottleneck | Cause | Symptoms | Severity |
|-----------|-------|----------|----------|
| **Tomcat thread exhaustion** | Default 200 threads, each holding a DB connection during the full request lifecycle | Requests queue, response times spike, eventual timeout | WARNING |
| **EventHandler execution time** | Complex derivation chains on `beforeSave` (multiple field computations, lookups) | Save operations take >1s, user perceives the form as "hanging" | WARNING |
| **DalProcess blocking threads** | Long-running processes (bulk operations, report generation) hold Tomcat threads | Thread pool depletion during process execution | WARNING |
| **Hibernate session size** | Loading large result sets creates many managed entities in the session | GC pressure, increased memory usage, potential OOM on very large queries | WARNING |
| **GC pauses** | Default GC settings, large heap with many short-lived objects | Periodic latency spikes (stop-the-world pauses) | WARNING |

**Mitigation priorities:**
1. Profile EventHandler execution time in production (add timing logs)
2. Run DalProcesses asynchronously where possible (separate thread pool or Etendo's process scheduler)
3. Enforce pagination in all list endpoints (maximum page size)
4. Tune JVM GC: use G1GC (default in Java 17), set `-XX:MaxGCPauseMillis=200`

### 2.3 Frontend

| Bottleneck | Cause | Symptoms | Severity |
|-----------|-------|----------|----------|
| **Initial SPA bundle size** | All shared chunks loaded on first visit | Slow initial load on slower connections | WARNING |
| **Window load time** | Dynamic import + parse + render of window-specific code | Delay when navigating to a new window for the first time | HEALTHY (usually <500ms) |
| **DataTable rendering with 1000+ rows** | DOM rendering of large tables without virtualization | Browser jank, high memory, slow scrolling | WARNING |
| **Multiple open tabs** | Each browser tab runs a full SPA instance | Memory multiplication (100-200MB per tab) | WARNING |
| **Large mock data in development** | JSON fixtures parsed on every page load during development | Development-only; no production impact | HEALTHY |

**Mitigation priorities:**
1. Implement virtual scrolling in DataTable (render only visible rows)
2. Enforce pagination limits (50 records default, 200 maximum)
3. Code-split aggressively (each window is already a dynamic import, verify chunk sizes)
4. Add bundle size budget to build pipeline (warn if shared chunks exceed threshold)

---

## 3. Scaling Strategies

### 3.1 Vertical Scaling (First Priority)

The simplest and most cost-effective approach for ERP workloads. Do this before considering horizontal scaling.

**Application Server (Tomcat/JVM):**

| Setting | Default | Recommended (50 users) | Recommended (200 users) |
|---------|---------|----------------------|------------------------|
| `-Xmx` (max heap) | 512MB-1GB | 4GB | 8GB |
| `-Xms` (initial heap) | Same as Xmx | 4GB | 8GB |
| `maxThreads` (Tomcat) | 200 | 200 | 400 |
| `acceptCount` (Tomcat queue) | 100 | 100 | 200 |
| GC algorithm | G1GC (default) | G1GC | G1GC |
| `-XX:MaxGCPauseMillis` | 200 | 200 | 150 |

**PostgreSQL:**

| Setting | Default | Recommended (50 users) | Recommended (200 users) |
|---------|---------|----------------------|------------------------|
| `shared_buffers` | 128MB | 2GB | 4GB (25% of RAM) |
| `work_mem` | 4MB | 16MB | 32MB |
| `effective_cache_size` | 4GB | 6GB | 12GB (75% of RAM) |
| `max_connections` | 100 | 100 | 200 |
| `random_page_cost` | 4.0 | 1.1 (SSD) | 1.1 (SSD) |

**Hardware:**

| Component | 50 Users | 200 Users |
|-----------|----------|-----------|
| CPU | 4 cores | 8 cores |
| RAM | 8GB | 16GB |
| Storage | SSD (NVMe preferred) | SSD (NVMe preferred) |
| Network | 1Gbps | 1Gbps |

### 3.2 Application Optimization

These optimizations apply regardless of scaling approach and should be implemented early.

**Database Query Optimization:**
- Add indexes for all generated HQL WHERE and ORDER BY clauses
- Use `EXPLAIN ANALYZE` on slow queries to verify index usage
- Configure `pg_stat_statements` to identify top queries by total time
- Batch FK lookups: instead of N+1 queries, use `IN (id1, id2, ...)` or Hibernate batch fetching

**API Response Optimization:**
- Enforce maximum page size in all list RequestHandlers (default: 50, max: 200)
- Return only required fields (DTO projection, not full entity)
- Compress responses (gzip via Tomcat or nginx)
- Set `Cache-Control` headers on GET endpoints for stable reference data

**Frontend Optimization:**
- Virtual scrolling in DataTable (render visible rows only, ~50 rows in viewport)
- Lazy load FK selector options (fetch on dropdown open, not on form load)
- Debounce search/autocomplete inputs (300ms)
- Preload next likely window on hover (link prefetching)

**EventHandler Optimization:**
- Cache lookup values (e.g., tax rates, currency conversions) in request-scoped or short-TTL cache
- Minimize OBDal queries inside `beforeSave` (batch where possible)
- Profile and log EventHandler execution time (see [10-observability.md](10-observability.md))

### 3.3 Horizontal Scaling (If Vertical Is Not Enough)

Only consider when vertical scaling is exhausted and performance targets are still not met. This adds significant operational complexity.

**Tomcat Clustering:**

```
                  ┌────────────────────┐
                  │  nginx / HAProxy   │
                  │  (sticky sessions) │
                  └──────┬─────────────┘
                    ┌────┴────┐
                    ▼         ▼
             ┌──────────┐  ┌──────────┐
             │ Tomcat 1 │  │ Tomcat 2 │
             └─────┬────┘  └─────┬────┘
                   │             │
                   ▼             ▼
             ┌────────────────────────┐
             │  PgBouncer (pooler)    │
             └───────────┬────────────┘
                         ▼
             ┌────────────────────────┐
             │    PostgreSQL          │
             └────────────────────────┘
```

| Consideration | Detail |
|--------------|--------|
| **Session affinity** | Required. Etendo's AD_Session is server-local. Use nginx `ip_hash` or cookie-based sticky sessions |
| **Hibernate L2 cache** | Must be disabled or made cluster-aware (e.g., Infinispan). Default ehcache is not cluster-safe |
| **Deployments** | Must deploy to all nodes. Rolling deployment: take one node out of the load balancer, deploy, verify, add back, repeat |
| **PgBouncer** | Required to pool connections from multiple Tomcat instances. Prevents exceeding PostgreSQL `max_connections` |

**PostgreSQL Read Replicas:**

For read-heavy workloads (list views, reports), route GET requests to a read replica.

| Consideration | Detail |
|--------------|--------|
| **Replication lag** | Streaming replication is near-real-time (ms), but not zero. A record saved on primary may not appear on replica for a brief moment |
| **Connection routing** | Application or PgBouncer must route reads to replica, writes to primary |
| **Complexity** | Significant. Requires changes to OBDal usage patterns or a connection proxy |

**Frontend CDN:**

The React SPA is already fully static and can be served from any CDN.

| CDN Option | Notes |
|-----------|-------|
| Cloudflare | Free tier available. Handles SSL, compression, caching |
| AWS CloudFront | Good if already using AWS infrastructure |
| nginx on separate server | Simple, no external dependency |

---

## 4. Load Testing Strategy

### 4.1 Tools

| Tool | Strengths | Best For |
|------|----------|----------|
| **k6** | JavaScript-based scripts, good reporting, CI-friendly | API load testing |
| **JMeter** | GUI for test creation, mature ecosystem | Complex workflows with multiple steps |
| **Artillery** | YAML config, easy to start, good for HTTP APIs | Quick API benchmarks |

### 4.2 Test Scenarios

| Scenario | Description | Metrics to Capture |
|----------|-------------|-------------------|
| **List view load** | 50 concurrent users querying Sales Order list (paginated, 50 records) | p50/p95/p99 response time, throughput (req/s), error rate |
| **Record save** | 20 concurrent users saving Sales Order records with EventHandler derivations | Response time, transaction duration, DB lock waits |
| **Process execution** | 10 concurrent users executing a DalProcess (e.g., document completion) | Process duration, thread pool usage, DB connections |
| **Mixed workload** | Realistic mix: 60% reads, 30% saves, 10% processes | Overall system behavior, resource utilization |
| **Ramp-up** | Gradually increase from 10 to 200 users over 10 minutes | Find the breaking point where response times degrade |

### 4.3 k6 Example Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // ramp up to 50 users
    { duration: '5m', target: 50 },   // hold at 50
    { duration: '2m', target: 100 },  // ramp to 100
    { duration: '5m', target: 100 },  // hold at 100
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],     // less than 1% errors
  },
};

export default function () {
  const res = http.get('https://erp.example.com/etendo_sf/salesorder?page=1&size=50', {
    headers: { 'Authorization': 'Bearer <token>' },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1); // simulate user think time
}
```

### 4.4 Establishing Baselines

Before optimizing, establish current performance:

1. Run load tests against staging environment that mirrors production data volume
2. Record: p50, p95, p99 response times per endpoint
3. Record: max throughput before degradation
4. Record: resource utilization at target load (CPU, memory, DB connections)
5. Store results in version control for comparison after optimizations

---

## 5. Capacity Planning

### 5.1 Resource Sizing Guide

| Concurrent Users | Tomcat | PostgreSQL | Server Specs | Architecture |
|-----------------|--------|-----------|-------------|-------------|
| **10** | 1 instance, 50 threads, 2GB heap | 20 connections, 1GB shared_buffers | 2 cores, 4GB RAM, SSD | Single server |
| **50** | 1 instance, 100 threads, 4GB heap | 40 connections, 2GB shared_buffers | 4 cores, 8GB RAM, SSD | Single server |
| **100** | 1 instance, 200 threads, 8GB heap | 80 connections, 4GB shared_buffers | 8 cores, 16GB RAM, SSD | Single server |
| **200** | 1 instance, 400 threads, 12GB heap | 120 connections, 6GB shared_buffers | 12 cores, 32GB RAM, SSD | Single server (consider split) |
| **500** | 2 instances (clustered), 200 threads each | 200 connections + PgBouncer | 8 cores, 16GB each | Separate Tomcat and DB servers |

### 5.2 Database Growth Estimation

| Factor | Estimate |
|--------|---------|
| Rows per active window per day | 50-500 (depends on business volume) |
| Average row size | 500 bytes - 2KB |
| Index overhead | ~30-50% of table size |
| Annual growth (medium business) | 5-20 GB per year |
| Recommended initial DB disk | 100GB SSD (ample room for years of operation) |

### 5.3 When to Scale

| Signal | Threshold | Action |
|--------|-----------|--------|
| API p95 > 2s sustained | 10+ minutes | Investigate slow queries, add indexes |
| API p95 > 5s sustained | 5+ minutes | Vertical scale or optimize |
| CPU > 80% sustained | 15+ minutes | Add cores or optimize code |
| Memory > 85% sustained | 15+ minutes | Increase heap or investigate leak |
| DB connections > 80% of max | Sustained | Increase pool or add PgBouncer |
| Disk > 80% | Any | Expand storage, archive old data |
| Thread pool queue > 50 | Sustained | Increase threads or add instance |

---

## 6. Performance Anti-Patterns to Avoid

| Anti-Pattern | Why It Hurts | Correct Approach |
|-------------|-------------|-----------------|
| Loading all records without pagination | OOM risk, slow response, browser freeze | Always paginate. Max page size: 200 |
| Resolving FK references in a loop (N+1) | Query count proportional to result size | Batch fetch: `WHERE id IN (...)` or Hibernate `@BatchSize` |
| Large EventHandler chains on `beforeSave` | Save latency directly impacts UX | Profile, cache lookups, minimize queries |
| Unbounded `IN` clause | PostgreSQL query planner struggles with 1000+ values | Use temporary table or batch into groups of 500 |
| Logging at DEBUG level in production | Log volume overwhelms I/O, fills disk | Use INFO in production, DEBUG only for troubleshooting |
| Not setting statement timeout | One runaway query can hold a connection forever | Set `statement_timeout` in PostgreSQL (30s for interactive, 5min for processes) |
| Synchronous report generation in request thread | Blocks Tomcat thread for minutes | Use async processing, return job ID, poll for completion |
