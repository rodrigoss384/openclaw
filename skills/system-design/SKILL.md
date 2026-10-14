---
name: system-design
description: Expert in System Design and Architecture. Use when designing scalable systems, architecting distributed applications, evaluating trade-offs, capacity planning, choosing technologies, designing databases, APIs, microservices, handling high traffic, ensuring reliability, or conducting system design interviews.
---

# System Design Skill

This skill provides comprehensive expertise in designing large-scale distributed systems, evaluating architectural trade-offs, and making informed technology decisions.

## When to Use This Skill

- Designing new systems or major features from scratch
- Architecting microservices and distributed systems
- Scalability and performance planning
- Database design and data modeling
- API design (REST, GraphQL, gRPC)
- Capacity planning and load estimation
- Technology stack selection
- System design interview preparation
- Evaluating architectural trade-offs
- High availability and disaster recovery planning
- Caching strategies and CDN architecture
- Message queue and event-driven architectures
- Monitoring and observability setup

## System Design Framework

### The 4-Step Approach

**1. Requirements Clarification (5-10 minutes)**
- Functional requirements (what the system does)
- Non-functional requirements (how well it performs)
- Constraints and assumptions
- Scale estimation

**2. High-Level Design (10-15 minutes)**
- Core components and their responsibilities
- Data flow between components
- API contracts
- Database schema (high-level)

**3. Deep Dive (15-20 minutes)**
- Bottleneck identification
- Scalability improvements
- Data partitioning strategies
- Caching layers
- Load balancing
- Reliability and fault tolerance

**4. Wrap-Up (5-10 minutes)**
- Trade-off discussion
- Monitoring and metrics
- Future improvements
- Cost considerations

## Requirements Gathering

### Functional Requirements

**Questions to Ask:**
- What are the core features?
- What actions can users perform?
- What are the inputs and outputs?
- What are the business rules?

**Example (Twitter-like system):**
- Users can post tweets (280 characters)
- Users can follow other users
- Users can view a home timeline
- Users can search tweets

### Non-Functional Requirements

**Categories:**

**Performance:**
- Latency requirements (p50, p95, p99)
- Throughput requirements (requests/second)
- Response time expectations

**Scalability:**
- Number of users (daily active, monthly active)
- Data volume (tweets, posts, videos)
- Growth rate projections

**Availability:**
- Uptime requirements (99.9%, 99.99%, 99.999%)
- Acceptable downtime per year
- Regional availability

**Consistency:**
- Strong consistency vs eventual consistency
- CAP theorem trade-offs

**Reliability:**
- Data durability requirements
- Disaster recovery objectives (RPO, RTO)
- Fault tolerance needs

**Security:**
- Authentication and authorization
- Data encryption (at rest, in transit)
- Compliance requirements (GDPR, HIPAA, PCI-DSS)

### Scale Estimation

**Calculate:**

1. **Storage Requirements**
```
Daily new data = Users × Average items per user × Item size
Monthly storage = Daily new data × 30
Yearly storage = Monthly storage × 12

Example (Instagram):
500M daily active users
2 photos per day average
Average photo: 200KB

Daily storage = 500M × 2 × 200KB = 200TB/day
Yearly storage = 200TB × 365 = 73PB/year
```

2. **Bandwidth Requirements**
```
Read bandwidth = Reads per second × Average data size
Write bandwidth = Writes per second × Average data size

Example:
100K reads/sec × 200KB = 20GB/sec read
10K writes/sec × 200KB = 2GB/sec write
```

3. **Memory Requirements (Cache)**
```
Cache size = Hot data percentage × Total data

Example:
Total data: 100TB
80-20 rule: cache 20% of data (hot data)
Cache needed: 20TB
```

4. **QPS (Queries Per Second)**
```
Daily active users: 100M
Average requests per user per day: 20
Total daily requests: 100M × 20 = 2B

QPS = 2B / 86,400 seconds ≈ 23,000 QPS
Peak QPS = QPS × 2 (safety margin) ≈ 46,000 QPS
```

## Core Components

### Load Balancer

**Purpose:** Distribute traffic across multiple servers

**Types:**
- **Layer 4 (Transport)**: TCP/UDP level, fast, no SSL termination
- **Layer 7 (Application)**: HTTP level, content-based routing, SSL termination

**Algorithms:**
- Round Robin: Equal distribution
- Least Connections: Route to server with fewest connections
- IP Hash: Same client → same server (session affinity)
- Weighted Round Robin: Different server capacities
- Least Response Time: Route to fastest server

**Popular Options:**
- NGINX
- HAProxy
- AWS ELB/ALB/NLB
- Google Cloud Load Balancer

### Application Servers

**Considerations:**
- Stateless design (for horizontal scaling)
- Health checks and auto-recovery
- Connection pooling
- Graceful shutdown
- Request timeouts

**Scaling Strategies:**
- **Vertical Scaling**: Bigger machines (limited, expensive)
- **Horizontal Scaling**: More machines (preferred, unlimited)

### Databases

**SQL vs NoSQL:**

| Aspect | SQL | NoSQL |
|--------|-----|-------|
| Schema | Fixed, structured | Flexible, schema-less |
| Scaling | Vertical (harder horizontal) | Horizontal (native) |
| Transactions | ACID guarantees | Eventual consistency (mostly) |
| Queries | Complex joins, SQL | Simple queries, no joins |
| Use Cases | Financial, ERP, CRM | Social media, IoT, real-time |

**SQL Options:**
- PostgreSQL: Feature-rich, JSONB support
- MySQL: Mature, widely used
- Amazon Aurora: MySQL/PostgreSQL compatible, cloud-native

**NoSQL Types:**

1. **Key-Value**: Redis, DynamoDB, Memcached
   - Use: Caching, session storage, real-time analytics

2. **Document**: MongoDB, Couchbase, DynamoDB
   - Use: Content management, user profiles, catalogs

3. **Column-Family**: Cassandra, HBase, ScyllaDB
   - Use: Time-series data, analytics, IoT

4. **Graph**: Neo4j, Amazon Neptune, ArangoDB
   - Use: Social networks, recommendation engines, fraud detection

### Caching

**Cache Levels:**

1. **Client-Side**: Browser cache, mobile app cache
2. **CDN**: Static content (images, CSS, JS)
3. **Application Cache**: In-memory (Redis, Memcached)
4. **Database Cache**: Query result cache

**Caching Strategies:**

**Cache-Aside (Lazy Loading):**
```
1. Application checks cache
2. If miss, read from database
3. Store in cache
4. Return data
```
- Pros: Only caches requested data
- Cons: Cache miss penalty, stale data risk

**Write-Through:**
```
1. Write to cache
2. Write to database synchronously
3. Return response
```
- Pros: Cache always fresh
- Cons: Write latency, unused data cached

**Write-Behind (Write-Back):**
```
1. Write to cache
2. Return response immediately
3. Write to database asynchronously
```
- Pros: Low write latency
- Cons: Risk of data loss

**Read-Through:**
```
Cache handles database reads automatically
```

**Cache Invalidation:**
- **TTL (Time To Live)**: Expire after X seconds
- **Event-Based**: Invalidate on updates
- **LRU (Least Recently Used)**: Remove least used items

### Message Queues

**Purpose:** Asynchronous communication, decoupling, load smoothing

**Common Patterns:**
- **Task Queue**: Background jobs (email, reports)
- **Pub/Sub**: Event distribution
- **Stream Processing**: Real-time data pipelines

**Technologies:**
- **RabbitMQ**: Feature-rich, flexible routing
- **Apache Kafka**: High throughput, event streaming
- **AWS SQS**: Managed, simple
- **Redis**: Lightweight, fast

### CDN (Content Delivery Network)

**Purpose:** Serve static content from edge locations

**Benefits:**
- Reduced latency (geographically closer to users)
- Reduced load on origin servers
- DDoS protection
- SSL/TLS termination

**What to Cache:**
- Images, videos
- JavaScript, CSS
- Static HTML pages
- API responses (with proper cache headers)

**Providers:**
- Cloudflare
- AWS CloudFront
- Fastly
- Akamai

## Design Patterns

### Database Patterns

**1. Database Sharding**

**Horizontal Partitioning:**
Split data across multiple databases based on a shard key

**Strategies:**
- **Hash-Based**: `shard = hash(user_id) % num_shards`
- **Range-Based**: `user_id 1-1M → shard1, 1M-2M → shard2`
- **Geography-Based**: US users → US shard, EU users → EU shard

**Considerations:**
- Choose shard key carefully (can't change easily)
- Avoid hot shards (uneven distribution)
- Cross-shard queries are expensive
- Rebalancing is complex

**2. Database Replication**

**Primary-Replica (Master-Slave):**
- Primary: Handles writes
- Replicas: Handle reads
- Use for read-heavy workloads

**Primary-Primary (Multi-Master):**
- All nodes handle reads and writes
- Complex conflict resolution
- Use for high availability

**3. Database Indexing**

**Types:**
- **B-Tree**: General purpose, range queries
- **Hash**: Equality lookups, fast
- **Full-Text**: Search queries
- **Geospatial**: Location-based queries

**Best Practices:**
- Index foreign keys
- Index columns used in WHERE, JOIN, ORDER BY
- Don't over-index (slows writes)
- Composite indexes for multi-column queries

### API Design Patterns

**1. REST API Best Practices**

```
GET    /users           # List users
GET    /users/{id}      # Get user
POST   /users           # Create user
PUT    /users/{id}      # Update user (full)
PATCH  /users/{id}      # Update user (partial)
DELETE /users/{id}      # Delete user

# Resources, not actions
GET /users/123/orders  # Good
GET /getUserOrders?id=123  # Bad

# Versioning
/api/v1/users
/api/v2/users

# Filtering, sorting, pagination
GET /users?status=active&sort=created_at&page=2&limit=20
```

**2. GraphQL**

**When to use:**
- Clients need flexible data fetching
- Multiple round trips to REST APIs
- Over-fetching/under-fetching problems

**Trade-offs:**
- More complex than REST
- Harder to cache
- Query complexity limits needed

**3. gRPC**

**When to use:**
- Service-to-service communication
- Performance critical
- Strongly typed contracts
- Bi-directional streaming

**Trade-offs:**
- Not browser-friendly (needs proxy)
- Binary format (harder to debug)
- Learning curve (Protocol Buffers)

### Scalability Patterns

**1. Microservices**

**When to use:**
- Large teams
- Different scaling requirements per service
- Independent deployment needs
- Polyglot architecture

**Trade-offs:**
- Operational complexity
- Distributed system challenges
- Network latency
- Data consistency

**2. Service Mesh**

**Purpose:** Handle service-to-service communication

**Features:**
- Load balancing
- Service discovery
- Circuit breakers
- Distributed tracing
- Mutual TLS

**Options:** Istio, Linkerd, Consul

**3. Rate Limiting**

**Algorithms:**

**Fixed Window:**
```
Allow N requests per minute
Resets at minute boundary
```

**Sliding Window:**
```
Allow N requests in any 60-second window
More accurate than fixed window
```

**Token Bucket:**
```
Tokens added at fixed rate
Request consumes token
Allows bursts
```

**Leaky Bucket:**
```
Requests processed at fixed rate
Smooths out bursts
```

**4. Circuit Breaker**

**States:**
1. **Closed**: Normal operation
2. **Open**: Failures exceeded threshold, reject requests
3. **Half-Open**: Test if service recovered

**Implementation:**
```typescript
class CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  failures: number = 0;
  threshold: number = 5;
  timeout: number = 60000; // 1 minute

  async call(fn: Function): Promise<any> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
```

## Common System Designs

### Design URL Shortener

**Requirements:**
- Shorten long URLs
- Redirect short URLs to original
- Custom aliases (optional)
- Analytics (optional)

**Scale:**
- 100M URLs created per month
- 10B redirects per month
- Read-heavy (100:1 read:write ratio)

**Design:**

1. **API:**
```
POST /api/v1/shorten
Body: { "url": "https://example.com/very/long/url" }
Response: { "short_url": "https://short.ly/abc123" }

GET /abc123
Response: 302 Redirect to original URL
```

2. **Short URL Generation:**
- Base62 encoding (a-z, A-Z, 0-9)
- 6 characters = 62^6 = 56 billion combinations
- Use auto-incrementing ID or hash

3. **Database Schema:**
```sql
CREATE TABLE urls (
  id BIGSERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  user_id BIGINT,
  INDEX idx_short_code (short_code)
);
```

4. **Architecture:**
```
Client → Load Balancer → App Servers → Cache (Redis) → Database
                                     ↓
                                 Analytics Queue
```

5. **Caching:**
- Cache popular URLs (80-20 rule)
- TTL: 24 hours
- Cache size: ~20GB for 100M URLs

### Design News Feed

**Requirements:**
- Users post updates
- Users follow other users
- Users see feed of updates from people they follow
- Feed sorted by recency

**Scale:**
- 1B users
- 500M daily active
- Average 5 posts/day
- Average user follows 200 people

**Design:**

1. **Database Schema:**
```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  created_at TIMESTAMP
);

CREATE TABLE posts (
  post_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(user_id),
  content TEXT,
  created_at TIMESTAMP,
  INDEX idx_user_created (user_id, created_at DESC)
);

CREATE TABLE follows (
  follower_id BIGINT REFERENCES users(user_id),
  followee_id BIGINT REFERENCES users(user_id),
  created_at TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id)
);
```

2. **Feed Generation Approaches:**

**Pull Model (Read-time):**
```
On feed request:
1. Get list of people user follows
2. Fetch recent posts from each
3. Merge and sort by timestamp
4. Return top N
```
- Pros: No fanout on write, fresh data
- Cons: Slow for users following many people

**Push Model (Write-time/Fanout):**
```
On new post:
1. Get list of followers
2. Insert post into each follower's feed
3. User reads from pre-built feed
```
- Pros: Fast reads
- Cons: Slow writes for celebrities, storage overhead

**Hybrid Model:**
```
Push for regular users
Pull for celebrities
Merge at read time
```

3. **Feed Storage:**
```
feed:{user_id} → Sorted Set (Redis)
- Score: timestamp
- Value: post_id
- Keep only recent N posts per user
```

4. **Architecture:**
```
Write Path:
Post → Load Balancer → API Server → Write to DB
                                  → Fanout Service → Feed Cache

Read Path:
User → Load Balancer → API Server → Feed Cache → Return
                                  → (if miss) → DB
```

### Design Rate Limiter

See `resources/RATE_LIMITER_DESIGN.md` for detailed implementation.

## Technology Selection Guide

### Database Selection

**Choose SQL when:**
- Complex queries with joins
- ACID transactions required
- Structured data with relationships
- Data integrity critical

**Choose NoSQL when:**
- Massive scale (horizontal scaling)
- Flexible schema
- Simple queries
- High write throughput
- Eventual consistency acceptable

### Cache Selection

**Redis:**
- Rich data structures (sets, sorted sets, lists)
- Persistence options
- Pub/Sub support
- Lua scripting

**Memcached:**
- Simple key-value
- Faster for simple operations
- Multi-threaded
- No persistence

### Message Queue Selection

**RabbitMQ:**
- Complex routing
- Message priority
- Per-message TTL
- Enterprise features

**Kafka:**
- Event streaming
- High throughput
- Message replay
- Data pipelines

**AWS SQS:**
- Fully managed
- Simple to use
- Good AWS integration
- Cost-effective for low volume

## Best Practices

### Scalability

✅ **DO:**
- Design for horizontal scaling
- Use stateless application servers
- Implement caching at multiple levels
- Use CDN for static content
- Partition data intelligently
- Use asynchronous processing for heavy tasks
- Implement pagination for large datasets
- Use connection pooling

❌ **DON'T:**
- Rely on vertical scaling alone
- Store session state in application memory
- Make synchronous calls for everything
- Return all data at once
- Keep all data in single database
- Use database for queuing

### Reliability

✅ **DO:**
- Implement retry logic with exponential backoff
- Use circuit breakers
- Design for failure
- Have health checks
- Implement graceful degradation
- Use timeouts everywhere
- Log errors with context
- Monitor everything

❌ **DON'T:**
- Assume services are always available
- Ignore partial failures
- Have infinite retries
- Skip error handling
- Trust network reliability
- Forget about cascading failures

### Performance

✅ **DO:**
- Use indexes wisely
- Implement caching
- Optimize database queries
- Use CDN for static assets
- Compress responses
- Use HTTP/2 or HTTP/3
- Implement lazy loading
- Profile before optimizing

❌ **DON'T:**
- Premature optimization
- Over-index databases
- Cache everything
- Ignore N+1 query problems
- Skip monitoring
- Guess at bottlenecks

## Resources

For detailed references and implementations, see files in `resources/`:
- `SCALABILITY_PATTERNS.md` - Comprehensive scalability patterns
- `DATABASE_DESIGN_GUIDE.md` - Database design and optimization
- `API_DESIGN_BEST_PRACTICES.md` - REST, GraphQL, gRPC guidelines
- `RATE_LIMITER_DESIGN.md` - Rate limiting implementation
- `SYSTEM_DESIGN_TEMPLATES.md` - Common system design templates

## Interview Tips

### Preparation Strategy

1. **Practice Common Problems:**
   - URL shortener
   - News feed
   - Chat system
   - Video streaming
   - Web crawler
   - Search autocomplete
   - Rate limiter
   - Notification system

2. **Study Real Systems:**
   - Read engineering blogs (Netflix, Uber, Airbnb, Twitter)
   - Understand trade-offs they made
   - Learn from their scale challenges

3. **Focus on Communication:**
   - Think out loud
   - Ask clarifying questions
   - Explain your reasoning
   - Discuss trade-offs
   - Be open to feedback

### During the Interview

**Structure:**
1. Clarify requirements (5 min)
2. High-level design (10 min)
3. Deep dive (20 min)
4. Discussion (10 min)

**Key Points:**
- Start simple, then scale
- Use numbers (back-of-envelope calculations)
- Draw diagrams
- Consider trade-offs
- Discuss monitoring and operations
- Think about failure scenarios

### Red Flags to Avoid

❌ Jumping to solution without understanding requirements
❌ Over-engineering for small scale
❌ Ignoring constraints
❌ Not considering trade-offs
❌ Being defensive about feedback
❌ Ignoring non-functional requirements
❌ Forgetting about monitoring/operations
