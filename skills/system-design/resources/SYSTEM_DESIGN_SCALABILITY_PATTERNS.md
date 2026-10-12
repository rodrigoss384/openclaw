# Scalability Patterns Reference

Complete guide to scalability patterns for designing systems that handle millions of users.

## Table of Contents

1. [Horizontal vs Vertical Scaling](#horizontal-vs-vertical-scaling)
2. [Database Scaling Patterns](#database-scaling-patterns)
3. [Caching Patterns](#caching-patterns)
4. [Load Balancing Patterns](#load-balancing-patterns)
5. [Asynchronous Processing](#asynchronous-processing)
6. [Data Partitioning](#data-partitioning)
7. [Microservices Patterns](#microservices-patterns)

---

## Horizontal vs Vertical Scaling

### Vertical Scaling (Scale Up)

**Definition:** Add more power to existing machines (CPU, RAM, disk)

**Advantages:**
- ✅ Simple to implement
- ✅ No code changes required
- ✅ No distributed system complexity
- ✅ Data consistency easier

**Disadvantages:**
- ❌ Hardware limits (finite ceiling)
- ❌ Single point of failure
- ❌ Downtime during upgrades
- ❌ Expensive at high end
- ❌ No geographical distribution

**When to use:**
- Small to medium applications
- Monolithic databases
- Legacy systems
- Initial development phase

### Horizontal Scaling (Scale Out)

**Definition:** Add more machines to distribute load

**Advantages:**
- ✅ No theoretical limit
- ✅ Cost-effective (commodity hardware)
- ✅ High availability (redundancy)
- ✅ Geographical distribution
- ✅ Rolling upgrades (no downtime)

**Disadvantages:**
- ❌ Application must be stateless
- ❌ Distributed system complexity
- ❌ Data consistency challenges
- ❌ Increased operational overhead

**When to use:**
- High traffic applications
- Global user base
- Need high availability
- Microservices architecture

---

## Database Scaling Patterns

### Pattern 1: Read Replicas

**Problem:** Database reads overwhelming primary server

**Solution:**
```
          ┌──────────┐
          │ Primary  │ (Writes)
          │ Database │
          └─────┬────┘
                │ Replication
      ┌─────────┼─────────┐
      ▼         ▼         ▼
  ┌───────┐ ┌───────┐ ┌───────┐
  │Replica│ │Replica│ │Replica│ (Reads)
  └───────┘ └───────┘ └───────┘
```

**Implementation:**

```python
class DatabaseRouter:
    def __init__(self):
        self.primary = Database("primary.db.com")
        self.replicas = [
            Database("replica1.db.com"),
            Database("replica2.db.com"),
            Database("replica3.db.com"),
        ]
        self.replica_index = 0

    def write(self, query):
        """All writes go to primary"""
        return self.primary.execute(query)

    def read(self, query):
        """Reads distributed across replicas"""
        replica = self.replicas[self.replica_index]
        self.replica_index = (self.replica_index + 1) % len(self.replicas)
        return replica.execute(query)
```

**Considerations:**
- Replication lag (eventual consistency)
- Read-after-write consistency issues
- Replica failure handling
- Monitor replication lag

**Best for:**
- Read-heavy workloads (90%+ reads)
- Analytics queries
- Reporting systems

### Pattern 2: Database Sharding

**Problem:** Single database can't handle all data or traffic

**Solution:** Split data across multiple databases (shards)

**Sharding Strategies:**

**1. Hash-Based Sharding**

```python
class HashSharding:
    def __init__(self, num_shards):
        self.num_shards = num_shards
        self.shards = [Database(f"shard{i}.db.com") 
                       for i in range(num_shards)]

    def get_shard(self, key):
        """Consistent hashing"""
        shard_id = hash(key) % self.num_shards
        return self.shards[shard_id]

    def save_user(self, user):
        shard = self.get_shard(user.id)
        return shard.execute(f"INSERT INTO users VALUES ({user})")

    def get_user(self, user_id):
        shard = self.get_shard(user_id)
        return shard.execute(f"SELECT * FROM users WHERE id={user_id}")
```

**Pros:**
- Even distribution
- Simple to implement

**Cons:**
- Difficult to rebalance
- Adding/removing shards requires rehashing
- Range queries span all shards

**2. Range-Based Sharding**

```python
class RangeSharding:
    def __init__(self):
        self.shard_ranges = [
            (0, 1_000_000, Database("shard1.db.com")),
            (1_000_001, 2_000_000, Database("shard2.db.com")),
            (2_000_001, 3_000_000, Database("shard3.db.com")),
        ]

    def get_shard(self, user_id):
        for start, end, shard in self.shard_ranges:
            if start <= user_id <= end:
                return shard
        raise ValueError("User ID out of range")
```

**Pros:**
- Range queries efficient
- Easy to add new shards

**Cons:**
- Risk of hot shards
- Uneven distribution
- Requires planning

**3. Geography-Based Sharding**

```python
class GeoSharding:
    def __init__(self):
        self.shards = {
            'US': Database("us.db.com"),
            'EU': Database("eu.db.com"),
            'ASIA': Database("asia.db.com"),
        }

    def get_shard(self, region):
        return self.shards.get(region)
```

**Pros:**
- Low latency (data near users)
- Compliance (data residency)
- Natural isolation

**Cons:**
- Global queries complex
- Uneven load
- Cross-region operations expensive

**Sharding Challenges:**

1. **Cross-Shard Joins**
```python
# Problem: User and their posts on different shards
user = shard1.get_user(user_id)
posts = shard2.get_posts(user_id)

# Solution: Denormalize or application-level join
```

2. **Distributed Transactions**
```python
# Problem: Transfer money between users on different shards
# Solution: Two-phase commit or Saga pattern

def transfer(from_user_id, to_user_id, amount):
    from_shard = get_shard(from_user_id)
    to_shard = get_shard(to_user_id)
    
    # Start distributed transaction
    with DistributedTransaction() as txn:
        from_shard.debit(from_user_id, amount)
        to_shard.credit(to_user_id, amount)
        txn.commit()
```

3. **Auto-Incrementing IDs**
```python
# Problem: ID collisions across shards
# Solutions:

# 1. UUID
user.id = uuid.uuid4()

# 2. Snowflake ID (Twitter)
# 64 bits: timestamp (41) + datacenter (5) + machine (5) + sequence (12)
user.id = generate_snowflake_id()

# 3. Database-specific sequences with offsets
# Shard 1: 1, 4, 7, 10...
# Shard 2: 2, 5, 8, 11...
# Shard 3: 3, 6, 9, 12...
```

### Pattern 3: CQRS (Command Query Responsibility Segregation)

**Problem:** Read and write requirements are different

**Solution:** Separate read and write models

```python
# Write Model (Optimized for writes)
class OrderWriteModel:
    def create_order(self, order):
        # Normalized schema
        self.write_db.execute("""
            INSERT INTO orders (id, customer_id, total)
            VALUES (?, ?, ?)
        """, (order.id, order.customer_id, order.total))
        
        for item in order.items:
            self.write_db.execute("""
                INSERT INTO order_items (order_id, product_id, quantity)
                VALUES (?, ?, ?)
            """, (order.id, item.product_id, item.quantity))

# Read Model (Optimized for queries)
class OrderReadModel:
    def get_order_details(self, order_id):
        # Denormalized view
        return self.read_db.execute("""
            SELECT 
                o.id,
                o.total,
                c.name as customer_name,
                c.email,
                json_agg(
                    json_build_object(
                        'product', p.name,
                        'quantity', oi.quantity,
                        'price', oi.price
                    )
                ) as items
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.id = ?
            GROUP BY o.id, c.name, c.email
        """, (order_id,))
```

**Synchronization:**

```python
# Event-driven sync
def on_order_created(event):
    # Update read model
    read_model.update_order_view(event.order_id)

# Periodic sync
async def sync_read_model():
    while True:
        changes = write_model.get_changes_since(last_sync)
        for change in changes:
            read_model.apply_change(change)
        await asyncio.sleep(1)
```

---

## Caching Patterns

### Pattern 1: Multi-Level Caching

```
Browser Cache (client-side)
        ↓
CDN Cache (edge)
        ↓
API Gateway Cache
        ↓
Application Cache (Redis/Memcached)
        ↓
Database Query Cache
        ↓
Database
```

**Implementation:**

```python
class MultiLevelCache:
    def __init__(self):
        self.l1_cache = {}  # In-memory (fastest)
        self.l2_cache = Redis()  # Distributed
        self.database = Database()

    def get(self, key):
        # L1: Check in-memory cache
        if key in self.l1_cache:
            return self.l1_cache[key]

        # L2: Check Redis
        value = self.l2_cache.get(key)
        if value:
            # Populate L1 for next access
            self.l1_cache[key] = value
            return value

        # L3: Database
        value = self.database.get(key)
        if value:
            # Populate both caches
            self.l2_cache.set(key, value, ttl=3600)
            self.l1_cache[key] = value
        return value
```

### Pattern 2: Cache Stampede Prevention

**Problem:** Cache expires, many requests hit database simultaneously

**Solution: Lock-based approach**

```python
import threading

class CacheWithLock:
    def __init__(self):
        self.cache = {}
        self.locks = {}
        self.lock = threading.Lock()

    def get(self, key):
        # Check cache
        if key in self.cache:
            return self.cache[key]

        # Acquire lock for this key
        with self.lock:
            if key not in self.locks:
                self.locks[key] = threading.Lock()
        
        key_lock = self.locks[key]

        with key_lock:
            # Double-check cache (another thread may have populated it)
            if key in self.cache:
                return self.cache[key]

            # Only one thread gets here
            value = self.database.get(key)
            self.cache[key] = value
            return value
```

**Solution: Probabilistic early expiration**

```python
import random

class ProbabilisticCache:
    def get(self, key):
        cached = self.redis.get(key)
        if not cached:
            return self.fetch_and_cache(key)

        value, expiry = cached
        ttl = expiry - time.time()
        
        # Probabilistic early refresh
        # As TTL approaches 0, probability of refresh approaches 1
        if random.random() < (1 - ttl / original_ttl):
            # Refresh in background
            threading.Thread(
                target=self.fetch_and_cache,
                args=(key,)
            ).start()

        return value
```

### Pattern 3: Write-Through vs Write-Behind

**Write-Through:**

```python
def save_user(user):
    # Write to cache first
    cache.set(f"user:{user.id}", user, ttl=3600)
    
    # Then write to database (synchronous)
    database.save(user)
    
    return user
```

**Write-Behind (Async):**

```python
def save_user(user):
    # Write to cache immediately
    cache.set(f"user:{user.id}", user, ttl=3600)
    
    # Queue database write (asynchronous)
    queue.enqueue('save_user_to_db', user)
    
    return user

# Background worker
def worker():
    while True:
        task = queue.dequeue()
        if task.type == 'save_user_to_db':
            database.save(task.data)
```

---

## Load Balancing Patterns

### Pattern 1: DNS Load Balancing

```
User requests example.com
        ↓
DNS returns different IPs:
- 1.2.3.4 (50% of time)
- 5.6.7.8 (50% of time)
```

**Pros:**
- Simple
- Geographic distribution
- No single point of failure

**Cons:**
- DNS caching issues
- No health checks
- Coarse-grained

### Pattern 2: Layer 7 Load Balancing

**Content-Based Routing:**

```nginx
# NGINX configuration
http {
    upstream api_servers {
        server api1.example.com;
        server api2.example.com;
    }

    upstream static_servers {
        server static1.example.com;
        server static2.example.com;
    }

    server {
        location /api/ {
            proxy_pass http://api_servers;
        }

        location /static/ {
            proxy_pass http://static_servers;
        }
    }
}
```

**Sticky Sessions:**

```nginx
upstream backend {
    ip_hash;  # Same client IP → same server
    server backend1.example.com;
    server backend2.example.com;
}
```

### Pattern 3: Client-Side Load Balancing

**Implementation:**

```python
class ClientSideLoadBalancer:
    def __init__(self, servers):
        self.servers = servers
        self.current = 0
        self.health_check_interval = 30

    def get_server(self):
        """Round-robin with health checks"""
        healthy_servers = [s for s in self.servers if s.is_healthy()]
        
        if not healthy_servers:
            raise Exception("No healthy servers available")

        server = healthy_servers[self.current % len(healthy_servers)]
        self.current += 1
        return server

    def call_service(self, endpoint, data):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                server = self.get_server()
                return server.request(endpoint, data)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                continue
```

---

## Asynchronous Processing

### Pattern 1: Task Queue

**Use Cases:**
- Email sending
- Report generation
- Image processing
- Video transcoding

**Implementation:**

```python
# Producer
def create_user(user_data):
    # Save to database immediately
    user = database.save_user(user_data)
    
    # Queue async tasks
    task_queue.enqueue('send_welcome_email', user.id)
    task_queue.enqueue('create_user_profile', user.id)
    task_queue.enqueue('notify_admin', user.id)
    
    return user

# Consumer
def worker():
    while True:
        task = task_queue.dequeue()
        
        try:
            if task.name == 'send_welcome_email':
                send_email(task.user_id)
            elif task.name == 'create_user_profile':
                create_profile(task.user_id)
            elif task.name == 'notify_admin':
                notify_admin(task.user_id)
        except Exception as e:
            # Retry logic
            if task.retries < 3:
                task.retries += 1
                task_queue.enqueue_delayed(task, delay=60 * task.retries)
            else:
                dead_letter_queue.enqueue(task)
```

### Pattern 2: Event Streaming

**Implementation with Kafka:**

```python
# Producer
def on_order_placed(order):
    event = {
        'event_type': 'OrderPlaced',
        'order_id': order.id,
        'user_id': order.user_id,
        'total': order.total,
        'timestamp': datetime.utcnow()
    }
    
    kafka_producer.send('order-events', event)

# Consumers (multiple services)

# Inventory Service
def inventory_consumer():
    for message in kafka_consumer.subscribe(['order-events']):
        if message['event_type'] == 'OrderPlaced':
            reserve_inventory(message['order_id'])

# Email Service
def email_consumer():
    for message in kafka_consumer.subscribe(['order-events']):
        if message['event_type'] == 'OrderPlaced':
            send_order_confirmation(message['user_id'], message['order_id'])

# Analytics Service
def analytics_consumer():
    for message in kafka_consumer.subscribe(['order-events']):
        if message['event_type'] == 'OrderPlaced':
            track_order_metrics(message)
```

---

## Data Partitioning

### Pattern 1: Hot-Warm-Cold Storage

**Strategy:** Move data based on access patterns

```python
class TieredStorage:
    def __init__(self):
        self.hot = Redis()  # In-memory, recent data
        self.warm = PostgreSQL()  # SSD, last 30 days
        self.cold = S3()  # Archive, > 30 days

    def store_event(self, event):
        # Always write to hot storage
        self.hot.set(f"event:{event.id}", event, ttl=3600)
        
        # Write to warm storage
        self.warm.insert(event)

    def get_event(self, event_id, date):
        # Check hot storage first
        event = self.hot.get(f"event:{event_id}")
        if event:
            return event

        # Check if data should be in warm or cold
        if (datetime.now() - date).days <= 30:
            return self.warm.get(event_id)
        else:
            return self.cold.get(event_id)

    def archive_old_data(self):
        """Background job to move warm → cold"""
        cutoff = datetime.now() - timedelta(days=30)
        old_events = self.warm.find_before(cutoff)
        
        for event in old_events:
            # Move to cold storage
            self.cold.put(event)
            # Remove from warm
            self.warm.delete(event.id)
```

### Pattern 2: Time-Based Partitioning

```sql
-- Monthly partitions
CREATE TABLE events_2026_01 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE events_2026_02 PARTITION OF events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Query automatically uses correct partition
SELECT * FROM events 
WHERE created_at >= '2026-01-15' 
  AND created_at < '2026-01-20';
```

**Benefits:**
- Fast queries on recent data
- Easy to archive old data (drop partition)
- Improved maintenance (vacuum, analyze)

---

## Microservices Patterns

### Pattern 1: API Gateway

**Purpose:** Single entry point for all client requests

```python
class APIGateway:
    def __init__(self):
        self.user_service = UserService()
        self.order_service = OrderService()
        self.product_service = ProductService()

    def handle_request(self, request):
        # Authentication
        if not self.authenticate(request):
            return {"error": "Unauthorized"}, 401

        # Rate limiting
        if self.rate_limiter.is_exceeded(request.user_id):
            return {"error": "Rate limit exceeded"}, 429

        # Route to appropriate service
        if request.path.startswith('/users'):
            return self.user_service.handle(request)
        elif request.path.startswith('/orders'):
            return self.order_service.handle(request)
        elif request.path.startswith('/products'):
            return self.product_service.handle(request)

    def authenticate(self, request):
        token = request.headers.get('Authorization')
        return self.auth_service.validate_token(token)
```

### Pattern 2: Service Discovery

**Client-Side Discovery:**

```python
class ServiceRegistry:
    def __init__(self):
        self.services = {}

    def register(self, service_name, instance):
        if service_name not in self.services:
            self.services[service_name] = []
        self.services[service_name].append(instance)

    def discover(self, service_name):
        instances = self.services.get(service_name, [])
        # Return healthy instance
        return random.choice([i for i in instances if i.is_healthy()])

# Usage
registry = ServiceRegistry()

# Services register themselves
registry.register('user-service', Instance('http://user1:8080'))
registry.register('user-service', Instance('http://user2:8080'))

# Clients discover services
user_service = registry.discover('user-service')
response = user_service.get_user(user_id)
```

This reference provides production-ready scalability patterns for building systems that scale to millions of users.
