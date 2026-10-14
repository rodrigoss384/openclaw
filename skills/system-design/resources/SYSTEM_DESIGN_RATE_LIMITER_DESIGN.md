# Rate Limiter Design

Complete guide to designing and implementing rate limiters for API protection and fair resource allocation.

## Requirements

### Functional Requirements
- Limit requests based on defined rules
- Return appropriate error when limit exceeded
- Support multiple rate limiting strategies
- Allow different limits for different users/endpoints

### Non-Functional Requirements
- Low latency (< 10ms overhead)
- Accurate (minimal false positives/negatives)
- Scalable (distributed system support)
- Fault tolerant (fail open or closed)
- Memory efficient

## Rate Limiting Algorithms

### 1. Fixed Window Counter

**Algorithm:**
- Count requests in fixed time windows
- Reset counter at window boundary

**Implementation:**
```python
import time
from collections import defaultdict

class FixedWindowRateLimiter:
    def __init__(self, max_requests, window_seconds):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(int)
    
    def is_allowed(self, user_id):
        # Get current window
        current_window = int(time.time() / self.window_seconds)
        key = f"{user_id}:{current_window}"
        
        # Increment counter
        self.requests[key] += 1
        
        # Check limit
        if self.requests[key] > self.max_requests:
            return False
        
        return True

# Usage
limiter = FixedWindowRateLimiter(max_requests=100, window_seconds=60)

if limiter.is_allowed(user_id="user123"):
    process_request()
else:
    return_error("Rate limit exceeded")
```

**Redis Implementation:**
```python
import redis
import time

class RedisFixedWindowRateLimiter:
    def __init__(self, redis_client, max_requests, window_seconds):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    def is_allowed(self, user_id):
        current_window = int(time.time() / self.window_seconds)
        key = f"rate_limit:{user_id}:{current_window}"
        
        # Atomic increment and expiry
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, self.window_seconds * 2)  # Extra time for cleanup
        count, _ = pipe.execute()
        
        return count[0] <= self.max_requests

# Usage
redis_client = redis.Redis(host='localhost', port=6379)
limiter = RedisFixedWindowRateLimiter(
    redis_client=redis_client,
    max_requests=100,
    window_seconds=60
)
```

**Pros:**
- ✅ Simple to implement
- ✅ Memory efficient
- ✅ Easy to understand

**Cons:**
- ❌ Burst at window boundaries
- ❌ Uneven distribution

**Example Problem:**
```
Window 1 (0-60s): 100 requests at 59s
Window 2 (60-120s): 100 requests at 61s

Result: 200 requests in 2 seconds! (burst)
```

### 2. Sliding Window Log

**Algorithm:**
- Store timestamp of each request
- Count requests in sliding window
- Remove old timestamps

**Implementation:**
```python
import time
from collections import defaultdict, deque

class SlidingWindowLogRateLimiter:
    def __init__(self, max_requests, window_seconds):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.logs = defaultdict(deque)
    
    def is_allowed(self, user_id):
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Remove old timestamps
        while self.logs[user_id] and self.logs[user_id][0] < cutoff:
            self.logs[user_id].popleft()
        
        # Check limit
        if len(self.logs[user_id]) >= self.max_requests:
            return False
        
        # Add current timestamp
        self.logs[user_id].append(now)
        return True
```

**Redis Implementation:**
```python
import redis
import time

class RedisSlidingWindowLogRateLimiter:
    def __init__(self, redis_client, max_requests, window_seconds):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    def is_allowed(self, user_id):
        key = f"rate_limit:log:{user_id}"
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Use sorted set with timestamps as scores
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, cutoff)
        
        # Count current entries
        pipe.zcard(key)
        
        # Add current timestamp
        pipe.zadd(key, {str(now): now})
        
        # Set expiry
        pipe.expire(key, self.window_seconds)
        
        _, count, _, _ = pipe.execute()
        
        return count < self.max_requests
```

**Pros:**
- ✅ Accurate
- ✅ No boundary issues

**Cons:**
- ❌ Memory intensive (stores all timestamps)
- ❌ Expensive cleanup

### 3. Sliding Window Counter

**Algorithm:**
- Hybrid of fixed window and sliding log
- Weighted average of current and previous window

**Implementation:**
```python
import time
from collections import defaultdict

class SlidingWindowCounterRateLimiter:
    def __init__(self, max_requests, window_seconds):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.counters = defaultdict(lambda: {"count": 0, "window": 0})
    
    def is_allowed(self, user_id):
        now = time.time()
        current_window = int(now / self.window_seconds)
        
        # Get counters for current and previous window
        prev_key = f"{user_id}:{current_window - 1}"
        curr_key = f"{user_id}:{current_window}"
        
        prev_count = self.counters.get(prev_key, {}).get("count", 0)
        curr_count = self.counters[curr_key].get("count", 0)
        
        # Calculate weighted count
        window_start = current_window * self.window_seconds
        elapsed_in_window = now - window_start
        previous_weight = 1 - (elapsed_in_window / self.window_seconds)
        
        estimated_count = (prev_count * previous_weight) + curr_count
        
        if estimated_count >= self.max_requests:
            return False
        
        # Increment current window
        self.counters[curr_key]["count"] += 1
        self.counters[curr_key]["window"] = current_window
        
        return True
```

**Pros:**
- ✅ Memory efficient (only 2 counters)
- ✅ Smooth rate limiting
- ✅ Better than fixed window

**Cons:**
- ❌ Approximate (not perfectly accurate)

### 4. Token Bucket

**Algorithm:**
- Bucket holds tokens
- Tokens added at fixed rate
- Request consumes token
- Allows bursts up to bucket size

**Implementation:**
```python
import time

class TokenBucketRateLimiter:
    def __init__(self, capacity, refill_rate):
        """
        capacity: Maximum tokens in bucket
        refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets = {}
    
    def is_allowed(self, user_id):
        now = time.time()
        
        if user_id not in self.buckets:
            self.buckets[user_id] = {
                "tokens": self.capacity,
                "last_refill": now
            }
        
        bucket = self.buckets[user_id]
        
        # Refill tokens
        time_elapsed = now - bucket["last_refill"]
        tokens_to_add = time_elapsed * self.refill_rate
        bucket["tokens"] = min(self.capacity, bucket["tokens"] + tokens_to_add)
        bucket["last_refill"] = now
        
        # Check if request can be served
        if bucket["tokens"] >= 1:
            bucket["tokens"] -= 1
            return True
        
        return False

# Usage
limiter = TokenBucketRateLimiter(capacity=100, refill_rate=10)  # 10 req/sec
```

**Redis Implementation (Lua script for atomicity):**
```lua
-- token_bucket.lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

-- Refill tokens
local time_elapsed = now - last_refill
local tokens_to_add = time_elapsed * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

-- Check if request allowed
if tokens >= 1 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return 1
else
    return 0
end
```

```python
class RedisTokenBucketRateLimiter:
    def __init__(self, redis_client, capacity, refill_rate):
        self.redis = redis_client
        self.capacity = capacity
        self.refill_rate = refill_rate
        
        # Load Lua script
        with open('token_bucket.lua', 'r') as f:
            self.script = self.redis.register_script(f.read())
    
    def is_allowed(self, user_id):
        key = f"rate_limit:bucket:{user_id}"
        now = time.time()
        
        result = self.script(
            keys=[key],
            args=[self.capacity, self.refill_rate, now]
        )
        
        return result == 1
```

**Pros:**
- ✅ Allows controlled bursts
- ✅ Smooth rate limiting
- ✅ Good for variable workloads

**Cons:**
- ❌ More complex
- ❌ Need to tune capacity and refill rate

### 5. Leaky Bucket

**Algorithm:**
- Requests added to queue
- Processed at fixed rate
- Queue has maximum size

**Implementation:**
```python
import time
from collections import deque
import threading

class LeakyBucketRateLimiter:
    def __init__(self, capacity, leak_rate):
        """
        capacity: Queue size
        leak_rate: Requests processed per second
        """
        self.capacity = capacity
        self.leak_rate = leak_rate
        self.buckets = {}
        self.lock = threading.Lock()
    
    def is_allowed(self, user_id):
        now = time.time()
        
        with self.lock:
            if user_id not in self.buckets:
                self.buckets[user_id] = {
                    "queue": deque(),
                    "last_leak": now
                }
            
            bucket = self.buckets[user_id]
            
            # Leak (process) requests
            time_elapsed = now - bucket["last_leak"]
            leaks = int(time_elapsed * self.leak_rate)
            
            for _ in range(min(leaks, len(bucket["queue"]))):
                bucket["queue"].popleft()
            
            bucket["last_leak"] = now
            
            # Check capacity
            if len(bucket["queue"]) >= self.capacity:
                return False
            
            # Add request to queue
            bucket["queue"].append(now)
            return True
```

**Pros:**
- ✅ Smooth output rate
- ✅ Predictable processing

**Cons:**
- ❌ Can't handle bursts well
- ❌ Queue management overhead

---

## Distributed Rate Limiting

### Centralized Approach (Redis)

**Architecture:**
```
App Server 1 ──┐
               ├──> Redis (central state)
App Server 2 ──┤
               │
App Server N ──┘
```

**Implementation:**
```python
import redis
import time

class DistributedRateLimiter:
    def __init__(self, redis_url, max_requests, window_seconds):
        self.redis = redis.from_url(redis_url)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    def is_allowed(self, user_id):
        key = f"rate_limit:{user_id}"
        now = int(time.time())
        window_start = now - self.window_seconds
        
        # Use sorted set for sliding window
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current entries
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(now): now})
        
        # Set expiry
        pipe.expire(key, self.window_seconds + 1)
        
        results = pipe.execute()
        request_count = results[1]
        
        return request_count < self.max_requests

# Usage
limiter = DistributedRateLimiter(
    redis_url="redis://localhost:6379",
    max_requests=100,
    window_seconds=60
)
```

**Pros:**
- ✅ Accurate across all servers
- ✅ Centralized control

**Cons:**
- ❌ Single point of failure
- ❌ Network latency
- ❌ Redis becomes bottleneck

### Local + Sync Approach

**Strategy:**
- Rate limit locally first (fast)
- Sync periodically to distributed store
- Accept slight inaccuracy for better performance

```python
class HybridRateLimiter:
    def __init__(self, redis_client, max_requests, window_seconds):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.local_cache = {}
        self.sync_interval = 5  # seconds
        self.last_sync = time.time()
    
    def is_allowed(self, user_id):
        # Check local cache first
        if user_id in self.local_cache:
            local_count, timestamp = self.local_cache[user_id]
            if time.time() - timestamp < self.window_seconds:
                if local_count >= self.max_requests:
                    return False
                self.local_cache[user_id] = (local_count + 1, timestamp)
                return True
        
        # Sync with Redis
        if time.time() - self.last_sync > self.sync_interval:
            self.sync_to_redis()
        
        # Check Redis
        count = self.get_count_from_redis(user_id)
        if count >= self.max_requests:
            return False
        
        # Update local cache
        self.local_cache[user_id] = (count + 1, time.time())
        return True
    
    def sync_to_redis(self):
        # Sync local counts to Redis
        for user_id, (count, _) in self.local_cache.items():
            key = f"rate_limit:{user_id}"
            self.redis.incrby(key, count)
            self.redis.expire(key, self.window_seconds)
        
        self.local_cache.clear()
        self.last_sync = time.time()
```

---

## Advanced Features

### Per-User Rate Limits

```python
class TieredRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.tiers = {
            'free': {'max_requests': 100, 'window': 3600},      # 100/hour
            'basic': {'max_requests': 1000, 'window': 3600},    # 1000/hour
            'premium': {'max_requests': 10000, 'window': 3600}, # 10000/hour
        }
    
    def is_allowed(self, user_id, tier='free'):
        config = self.tiers.get(tier, self.tiers['free'])
        
        limiter = RedisFixedWindowRateLimiter(
            redis_client=self.redis,
            max_requests=config['max_requests'],
            window_seconds=config['window']
        )
        
        return limiter.is_allowed(user_id)
```

### Per-Endpoint Rate Limits

```python
class EndpointRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.endpoint_limits = {
            '/api/search': {'max': 10, 'window': 60},    # 10/min
            '/api/upload': {'max': 5, 'window': 3600},   # 5/hour
            '/api/users': {'max': 100, 'window': 60},    # 100/min
        }
    
    def is_allowed(self, user_id, endpoint):
        config = self.endpoint_limits.get(endpoint)
        
        if not config:
            return True  # No limit for this endpoint
        
        key = f"rate_limit:{user_id}:{endpoint}"
        return self.check_limit(key, config['max'], config['window'])
```

### Rate Limit Headers

```python
from flask import Flask, request, jsonify

app = Flask(__name__)
limiter = DistributedRateLimiter(redis_url="redis://localhost")

@app.before_request
def check_rate_limit():
    user_id = request.headers.get('X-User-ID')
    
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 400
    
    # Get current count
    count = limiter.get_count(user_id)
    remaining = max(0, limiter.max_requests - count)
    reset_time = limiter.get_reset_time(user_id)
    
    # Add headers to response
    @app.after_request
    def add_headers(response):
        response.headers['X-RateLimit-Limit'] = str(limiter.max_requests)
        response.headers['X-RateLimit-Remaining'] = str(remaining)
        response.headers['X-RateLimit-Reset'] = str(reset_time)
        return response
    
    # Check limit
    if not limiter.is_allowed(user_id):
        response = jsonify({
            "error": "Rate limit exceeded",
            "retry_after": reset_time - time.time()
        })
        response.status_code = 429
        response.headers['Retry-After'] = str(int(reset_time - time.time()))
        return response
```

---

## Performance Considerations

### Memory Usage Comparison

| Algorithm | Memory per User | Notes |
|-----------|----------------|-------|
| Fixed Window | O(1) | Just a counter |
| Sliding Log | O(n) | Stores all timestamps |
| Sliding Counter | O(1) | Two counters |
| Token Bucket | O(1) | Tokens + timestamp |
| Leaky Bucket | O(n) | Queue of requests |

### Latency Comparison

| Approach | Typical Latency |
|----------|----------------|
| Local (in-memory) | < 1ms |
| Redis (same datacenter) | 1-5ms |
| Redis (cross-region) | 50-200ms |

### Choosing the Right Algorithm

**Fixed Window:**
- ✅ Simple APIs with predictable traffic
- ✅ Memory constrained
- ❌ Cannot tolerate bursts

**Sliding Window Log:**
- ✅ Need perfect accuracy
- ✅ Low traffic volume
- ❌ Memory constraints

**Sliding Window Counter:**
- ✅ Balance accuracy and memory
- ✅ Most use cases
- ✅ Recommended default

**Token Bucket:**
- ✅ Allow controlled bursts
- ✅ Variable workloads
- ✅ User-facing APIs

**Leaky Bucket:**
- ✅ Backend services
- ✅ Need smooth output rate
- ❌ User-facing (poor burst handling)

This comprehensive guide provides production-ready implementations for various rate limiting strategies.
