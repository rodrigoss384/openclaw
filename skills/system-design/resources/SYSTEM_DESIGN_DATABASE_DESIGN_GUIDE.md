# Database Design Guide

Comprehensive guide to designing, optimizing, and scaling databases for large-scale systems.

## Table of Contents

1. [Database Selection](#database-selection)
2. [Schema Design](#schema-design)
3. [Indexing Strategies](#indexing-strategies)
4. [Query Optimization](#query-optimization)
5. [Normalization vs Denormalization](#normalization-vs-denormalization)
6. [Data Modeling Patterns](#data-modeling-patterns)
7. [NoSQL Design Patterns](#nosql-design-patterns)

---

## Database Selection

### Decision Matrix

| Requirement | SQL | NoSQL Document | NoSQL Key-Value | NoSQL Column | NoSQL Graph |
|-------------|-----|----------------|-----------------|--------------|-------------|
| ACID Transactions | ✅ | ⚠️ Limited | ❌ | ❌ | ⚠️ Limited |
| Complex Queries | ✅ | ⚠️ Limited | ❌ | ⚠️ Limited | ✅ |
| Horizontal Scaling | ⚠️ Hard | ✅ | ✅ | ✅ | ⚠️ Medium |
| Flexible Schema | ❌ | ✅ | ✅ | ✅ | ✅ |
| Joins | ✅ | ❌ | ❌ | ❌ | ✅ |
| Strong Consistency | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Low Latency Reads | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| Write Performance | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |

### Use Case Mapping

**SQL (PostgreSQL, MySQL):**
```
✅ Use for:
- Financial transactions
- User authentication
- Order management
- Inventory systems
- CRM systems
- ERP systems

Examples:
- Banking systems
- E-commerce checkout
- Accounting software
```

**NoSQL Document (MongoDB, CouchDB):**
```
✅ Use for:
- Content management
- User profiles
- Product catalogs
- Real-time analytics
- Mobile app backends

Examples:
- Blog platforms
- E-commerce product catalogs
- User preference storage
```

**NoSQL Key-Value (Redis, DynamoDB):**
```
✅ Use for:
- Session storage
- Caching
- Rate limiting
- Real-time leaderboards
- Queue systems

Examples:
- Shopping cart
- User sessions
- API rate limiting
```

**NoSQL Column-Family (Cassandra, HBase):**
```
✅ Use for:
- Time-series data
- IoT sensor data
- Event logging
- Analytics
- Write-heavy workloads

Examples:
- Netflix viewing history
- Uber ride history
- Server metrics
```

**NoSQL Graph (Neo4j, Neptune):**
```
✅ Use for:
- Social networks
- Recommendation engines
- Fraud detection
- Knowledge graphs
- Network analysis

Examples:
- LinkedIn connections
- Facebook friend graph
- Fraud detection systems
```

---

## Schema Design

### Entity-Relationship Design Process

**Step 1: Identify Entities**
```
Nouns in requirements → Entities

Example (Twitter):
- User
- Tweet
- Like
- Follow
- Hashtag
```

**Step 2: Identify Relationships**
```
Verbs in requirements → Relationships

- User creates Tweet (1:N)
- User likes Tweet (M:N)
- User follows User (M:N)
- Tweet contains Hashtag (M:N)
```

**Step 3: Define Attributes**
```sql
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    profile_image_url VARCHAR(500),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tweets (
    tweet_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    content VARCHAR(280) NOT NULL,
    reply_to_tweet_id BIGINT REFERENCES tweets(tweet_id),
    retweet_of_tweet_id BIGINT REFERENCES tweets(tweet_id),
    like_count INT DEFAULT 0,
    retweet_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_created (created_at DESC)
);

CREATE TABLE likes (
    user_id BIGINT REFERENCES users(user_id),
    tweet_id BIGINT REFERENCES tweets(tweet_id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, tweet_id),
    INDEX idx_tweet_id (tweet_id)
);

CREATE TABLE follows (
    follower_id BIGINT REFERENCES users(user_id),
    followee_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id),
    INDEX idx_followee (followee_id),
    CHECK (follower_id != followee_id)
);
```

### Data Types Selection

**Strings:**
```sql
-- Fixed length (faster for exact sizes)
CHAR(10)        -- Country code: "US", "GB", "FR"

-- Variable length (space efficient)
VARCHAR(255)    -- Email, username
TEXT            -- Long content (tweets, posts, comments)

-- Guidelines:
-- Use VARCHAR when you know max length
-- Use TEXT for unbounded content
-- Avoid CHAR unless truly fixed length
```

**Numbers:**
```sql
-- Integers
SMALLINT        -- -32,768 to 32,767 (age, quantity)
INT             -- Standard counter (user_id, post_id)
BIGINT          -- Large counters (tweet_id for billions)

-- Auto-increment
SERIAL          -- Auto-incrementing INT
BIGSERIAL       -- Auto-incrementing BIGINT

-- Decimals
DECIMAL(10,2)   -- Money (exact: $99999999.99)
NUMERIC(10,2)   -- Same as DECIMAL
FLOAT           -- Scientific data (approximate)

-- Guidelines:
-- Use DECIMAL/NUMERIC for money (never FLOAT)
-- Use BIGINT for IDs in large systems
-- Use SMALLINT when range is known and small
```

**Dates and Times:**
```sql
DATE            -- Birthday, event date
TIME            -- Opening hours, duration
TIMESTAMP       -- Created_at, updated_at (with timezone!)
TIMESTAMPTZ     -- PostgreSQL timezone-aware timestamp
INTERVAL        -- Duration (30 days, 2 hours)

-- Best practices:
-- Always use TIMESTAMPTZ in PostgreSQL
-- Store in UTC, convert to local in application
-- Use TIMESTAMP for audit fields
```

**JSON:**
```sql
JSON            -- Standard JSON (stored as text)
JSONB           -- Binary JSON (PostgreSQL, faster, indexable)

-- Example:
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    attributes JSONB,  -- { "color": "red", "size": "L" }
    
    -- Index for JSON queries
    INDEX idx_attributes_color ((attributes->>'color'))
);

-- Query:
SELECT * FROM products 
WHERE attributes->>'color' = 'red';
```

---

## Indexing Strategies

### Index Types

**1. B-Tree Index (Default)**

**Best for:**
- Equality and range queries
- Sorting (ORDER BY)
- Min/Max queries

```sql
-- Single column
CREATE INDEX idx_users_email ON users(email);

-- Composite (order matters!)
CREATE INDEX idx_tweets_user_created ON tweets(user_id, created_at DESC);

-- Query uses index:
SELECT * FROM tweets 
WHERE user_id = 123 
ORDER BY created_at DESC;
```

**Composite Index Rules:**
```sql
CREATE INDEX idx_abc ON table(a, b, c);

-- ✅ Uses index:
WHERE a = 1
WHERE a = 1 AND b = 2
WHERE a = 1 AND b = 2 AND c = 3

-- ❌ Doesn't use index:
WHERE b = 2
WHERE c = 3
WHERE b = 2 AND c = 3

-- Leftmost prefix rule applies!
```

**2. Hash Index**

**Best for:**
- Equality comparisons only
- Fast lookups

```sql
CREATE INDEX idx_users_email_hash ON users USING HASH(email);

-- ✅ Uses index:
WHERE email = 'user@example.com'

-- ❌ Doesn't use index:
WHERE email LIKE 'user%'
```

**3. GiST/GIN Index (PostgreSQL)**

**Full-Text Search:**
```sql
-- Add tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Update with text content
UPDATE articles 
SET search_vector = to_tsvector('english', title || ' ' || content);

-- Create GIN index
CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);

-- Query:
SELECT * FROM articles 
WHERE search_vector @@ to_tsquery('english', 'postgresql & performance');
```

**JSONB Index:**
```sql
CREATE INDEX idx_attributes ON products USING GIN(attributes);

-- Query:
SELECT * FROM products 
WHERE attributes @> '{"color": "red"}';
```

**4. Partial Index**

**Index subset of rows:**
```sql
-- Only index active users
CREATE INDEX idx_active_users ON users(email) 
WHERE status = 'active';

-- Smaller, faster index
-- Perfect for filtered queries
SELECT * FROM users 
WHERE status = 'active' AND email = 'user@example.com';
```

**5. Covering Index**

**Include all columns needed by query:**
```sql
CREATE INDEX idx_tweets_covering ON tweets(user_id, created_at DESC) 
INCLUDE (content, like_count);

-- Query doesn't need to access table:
SELECT content, like_count 
FROM tweets 
WHERE user_id = 123 
ORDER BY created_at DESC;
```

### Indexing Best Practices

**DO:**
```sql
✅ Index foreign keys
CREATE INDEX idx_tweets_user_id ON tweets(user_id);

✅ Index columns in WHERE clauses
CREATE INDEX idx_users_created ON users(created_at);

✅ Index columns in ORDER BY
CREATE INDEX idx_products_price ON products(price);

✅ Index columns in JOIN conditions
CREATE INDEX idx_orders_user_id ON orders(user_id);

✅ Use composite indexes for common query patterns
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

**DON'T:**
```sql
❌ Index low-cardinality columns alone
-- Bad: gender (only M/F/Other)
CREATE INDEX idx_users_gender ON users(gender);

❌ Over-index (slows writes)
-- Don't index every column

❌ Duplicate indexes
-- Bad: (a, b) and (a, b, c) - second covers first
CREATE INDEX idx_ab ON table(a, b);
CREATE INDEX idx_abc ON table(a, b, c);  -- Redundant

❌ Index columns that are always accessed with =
-- Use WHERE user_id = ? consistently
-- Not WHERE user_id > ?
```

---

## Query Optimization

### EXPLAIN ANALYZE

**Understanding Query Plans:**

```sql
EXPLAIN ANALYZE
SELECT u.username, COUNT(t.tweet_id) as tweet_count
FROM users u
LEFT JOIN tweets t ON u.user_id = t.user_id
WHERE u.created_at > '2026-01-01'
GROUP BY u.user_id, u.username
ORDER BY tweet_count DESC
LIMIT 10;
```

**Key Metrics:**
```
Seq Scan        ❌ Bad (scanning whole table)
Index Scan      ✅ Good (using index)
Index Only Scan ✅ Better (covering index)
Bitmap Scan     ⚠️  OK (multiple indexes combined)

Cost: 0.00..1000.00  -- Estimated cost
Rows: 1000           -- Estimated rows
Actual time          -- Real execution time
```

### N+1 Query Problem

**Problem:**
```python
# ❌ BAD: N+1 queries
users = db.query("SELECT * FROM users LIMIT 100")
for user in users:
    # This executes 100 separate queries!
    tweets = db.query(f"SELECT * FROM tweets WHERE user_id = {user.id}")
```

**Solution 1: JOIN**
```python
# ✅ GOOD: Single query
results = db.query("""
    SELECT 
        u.*,
        t.*
    FROM users u
    LEFT JOIN tweets t ON u.user_id = t.user_id
    LIMIT 100
""")
```

**Solution 2: IN clause**
```python
# ✅ GOOD: 2 queries total
users = db.query("SELECT * FROM users LIMIT 100")
user_ids = [u.id for u in users]

tweets = db.query(f"""
    SELECT * FROM tweets 
    WHERE user_id IN ({','.join(map(str, user_ids))})
""")

# Group tweets by user in application
```

### Pagination Optimization

**❌ Bad: OFFSET**
```sql
-- Gets slower as offset increases
SELECT * FROM tweets 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 100000;  -- Scans and discards 100,000 rows!
```

**✅ Good: Cursor-based (Keyset Pagination)**
```sql
-- First page
SELECT * FROM tweets 
ORDER BY created_at DESC 
LIMIT 20;

-- Next page (using last_created_at from previous page)
SELECT * FROM tweets 
WHERE created_at < '2026-01-15 10:30:00'
ORDER BY created_at DESC 
LIMIT 20;
```

**Implementation:**
```python
class CursorPagination:
    def get_page(self, cursor=None, limit=20):
        query = "SELECT * FROM tweets "
        
        if cursor:
            # Cursor format: "2026-01-15T10:30:00"
            query += f"WHERE created_at < '{cursor}' "
        
        query += f"ORDER BY created_at DESC LIMIT {limit}"
        
        results = db.execute(query)
        
        next_cursor = None
        if len(results) == limit:
            next_cursor = results[-1].created_at
        
        return {
            'data': results,
            'next_cursor': next_cursor
        }
```

### Connection Pooling

**Problem:** Creating new DB connections is expensive

**Solution:**
```python
from sqlalchemy import create_engine, pool

# Configure connection pool
engine = create_engine(
    'postgresql://user:pass@localhost/db',
    poolclass=pool.QueuePool,
    pool_size=20,          # Connections to keep open
    max_overflow=10,       # Additional connections if needed
    pool_timeout=30,       # Wait time for connection
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True     # Test connection before using
)

# Connection pool automatically manages connections
with engine.connect() as conn:
    result = conn.execute("SELECT * FROM users")
```

---

## Normalization vs Denormalization

### Normalization

**First Normal Form (1NF):**
- Atomic values (no arrays)
- Each row is unique

**❌ Violates 1NF:**
```sql
CREATE TABLE users (
    user_id INT,
    name VARCHAR(100),
    phone_numbers VARCHAR(255)  -- "555-1234, 555-5678" ❌
);
```

**✅ Satisfies 1NF:**
```sql
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE phone_numbers (
    user_id INT REFERENCES users(user_id),
    phone_number VARCHAR(20),
    PRIMARY KEY (user_id, phone_number)
);
```

**Second Normal Form (2NF):**
- Must be in 1NF
- No partial dependencies

**Third Normal Form (3NF):**
- Must be in 2NF
- No transitive dependencies

**Example (Normalized E-commerce):**
```sql
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    name VARCHAR(100)
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    order_date TIMESTAMP,
    total DECIMAL(10,2)
);

CREATE TABLE order_items (
    order_id INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id),
    quantity INT,
    price DECIMAL(10,2),
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10,2)
);
```

### Denormalization

**When to denormalize:**
- Read performance critical
- Same data joined frequently
- Update frequency is low
- Acceptable staleness

**Example (Denormalized for Performance):**
```sql
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INT,
    customer_email VARCHAR(255),      -- Denormalized
    customer_name VARCHAR(100),        -- Denormalized
    order_date TIMESTAMP,
    total DECIMAL(10,2),
    item_count INT,                    -- Denormalized aggregate
    
    -- No joins needed for common queries!
    INDEX idx_customer (customer_id)
);

-- Trade-off: Must update customer_email in ALL orders if changed
```

**Materialized Views (Best of Both Worlds):**
```sql
-- Keep normalized tables
-- Create denormalized view for queries

CREATE MATERIALIZED VIEW order_summary AS
SELECT 
    o.order_id,
    o.order_date,
    c.customer_id,
    c.email,
    c.name,
    COUNT(oi.product_id) as item_count,
    SUM(oi.quantity * oi.price) as total
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id, o.order_date, c.customer_id, c.email, c.name;

-- Refresh periodically
REFRESH MATERIALIZED VIEW order_summary;

-- Query the view (fast!)
SELECT * FROM order_summary WHERE customer_id = 123;
```

---

## NoSQL Design Patterns

### MongoDB Document Design

**Embedding vs Referencing:**

**Embed when:**
- 1:1 relationships
- 1:Few relationships
- Data accessed together
- Data doesn't change often

```javascript
// ✅ Embed address in user document
{
  _id: ObjectId("..."),
  name: "John Doe",
  email: "john@example.com",
  address: {  // Embedded
    street: "123 Main St",
    city: "New York",
    zip: "10001"
  }
}
```

**Reference when:**
- 1:Many relationships
- Many:Many relationships
- Data accessed independently
- Data changes frequently

```javascript
// ✅ Reference posts separately
// User document
{
  _id: ObjectId("user123"),
  name: "John Doe",
  email: "john@example.com"
}

// Post documents
{
  _id: ObjectId("post1"),
  user_id: ObjectId("user123"),  // Reference
  title: "First Post",
  content: "..."
}
```

### DynamoDB Design Patterns

**Single Table Design:**

```javascript
// Instead of multiple tables, use single table with different entity types

// User
{
  PK: "USER#john@example.com",
  SK: "PROFILE",
  type: "user",
  name: "John Doe",
  created_at: "2026-01-01"
}

// User's Post
{
  PK: "USER#john@example.com",
  SK: "POST#2026-01-15#uuid",
  type: "post",
  title: "My Post",
  content: "..."
}

// Comment on Post
{
  PK: "POST#uuid",
  SK: "COMMENT#2026-01-16#uuid2",
  type: "comment",
  user: "jane@example.com",
  text: "Great post!"
}

// Queries:
// Get user profile: PK = "USER#john@example.com" AND SK = "PROFILE"
// Get user's posts: PK = "USER#john@example.com" AND SK begins_with "POST#"
// Get post comments: PK = "POST#uuid" AND SK begins_with "COMMENT#"
```

This guide provides comprehensive patterns for designing scalable, performant databases.
