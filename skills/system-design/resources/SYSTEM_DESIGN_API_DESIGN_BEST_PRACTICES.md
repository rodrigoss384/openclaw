# API Design Best Practices

Comprehensive guide to designing REST, GraphQL, and gRPC APIs that are scalable, maintainable, and developer-friendly.

## REST API Design

### Resource Naming

**Rules:**
1. Use nouns, not verbs
2. Use plural for collections
3. Use kebab-case for multi-word resources
4. Nest resources logically (max 2-3 levels)

**✅ Good Examples:**
```
GET    /users
GET    /users/123
GET    /users/123/orders
GET    /users/123/orders/456
POST   /users
PUT    /users/123
DELETE /users/123
GET    /blog-posts
GET    /product-categories
```

**❌ Bad Examples:**
```
GET    /getAllUsers          // Verb in URL
GET    /user                 // Singular
GET    /users/getOrders      // Verb in URL
GET    /users/123/orders/456/items/789/reviews  // Too deep
POST   /createUser           // Verb in URL
GET    /blog_posts           // snake_case
```

### HTTP Methods

**Standard CRUD Operations:**

```
GET    /resources           # List all (with pagination)
GET    /resources/{id}      # Get single resource
POST   /resources           # Create new resource
PUT    /resources/{id}      # Full update (replace)
PATCH  /resources/{id}      # Partial update (modify)
DELETE /resources/{id}      # Delete resource
```

**Method Semantics:**

| Method | Safe | Idempotent | Cacheable |
|--------|------|------------|-----------|
| GET    | ✅   | ✅         | ✅        |
| POST   | ❌   | ❌         | ❌*       |
| PUT    | ❌   | ✅         | ❌        |
| PATCH  | ❌   | ❌**       | ❌        |
| DELETE | ❌   | ✅         | ❌        |

\* POST responses can be cached with explicit headers
\*\* PATCH can be designed to be idempotent

### Request/Response Design

**Request Body (POST/PUT):**
```json
POST /api/v1/users
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "age": 30,
  "preferences": {
    "newsletter": true,
    "notifications": "email"
  }
}
```

**Response Format:**
```json
HTTP/1.1 201 Created
Location: /api/v1/users/12345
Content-Type: application/json

{
  "id": "12345",
  "email": "user@example.com",
  "name": "John Doe",
  "age": 30,
  "preferences": {
    "newsletter": true,
    "notifications": "email"
  },
  "created_at": "2026-02-02T10:30:00Z",
  "updated_at": "2026-02-02T10:30:00Z",
  "_links": {
    "self": "/api/v1/users/12345",
    "orders": "/api/v1/users/12345/orders"
  }
}
```

### Error Handling

**Standard Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "age",
        "message": "Age must be between 18 and 120"
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2026-02-02T10:30:00Z"
  }
}
```

**HTTP Status Codes:**

**2xx Success:**
```
200 OK                 # Standard success
201 Created            # Resource created
202 Accepted           # Async processing started
204 No Content         # Success, no response body
```

**3xx Redirection:**
```
301 Moved Permanently  # Resource moved
304 Not Modified       # Use cached version
```

**4xx Client Error:**
```
400 Bad Request        # Invalid request
401 Unauthorized       # Not authenticated
403 Forbidden          # Authenticated but not authorized
404 Not Found          # Resource doesn't exist
405 Method Not Allowed # Wrong HTTP method
409 Conflict           # Resource conflict (e.g., duplicate)
422 Unprocessable      # Valid JSON, but semantically incorrect
429 Too Many Requests  # Rate limit exceeded
```

**5xx Server Error:**
```
500 Internal Server Error  # Generic server error
502 Bad Gateway           # Upstream service error
503 Service Unavailable   # Temporarily down
504 Gateway Timeout       # Upstream timeout
```

### Filtering, Sorting, Pagination

**Filtering:**
```
GET /users?status=active
GET /users?status=active&role=admin
GET /users?created_after=2026-01-01
GET /products?price_min=10&price_max=100
GET /products?category=electronics&in_stock=true
```

**Sorting:**
```
GET /users?sort=created_at         # Ascending
GET /users?sort=-created_at        # Descending (minus prefix)
GET /users?sort=name,-created_at   # Multiple fields
```

**Pagination:**

**Offset-based:**
```
GET /users?page=1&limit=20
GET /users?offset=0&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1000,
    "pages": 50
  },
  "links": {
    "self": "/users?page=1&limit=20",
    "next": "/users?page=2&limit=20",
    "prev": null,
    "first": "/users?page=1&limit=20",
    "last": "/users?page=50&limit=20"
  }
}
```

**Cursor-based (recommended for large datasets):**
```
GET /users?limit=20
GET /users?cursor=eyJpZCI6MTIzfQ&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "has_more": true
  }
}
```

### Versioning

**URL Path (Recommended):**
```
/api/v1/users
/api/v2/users

Pros: Clear, cacheable, easy to route
Cons: URL proliferation
```

**Header:**
```
GET /api/users
Accept: application/vnd.company.v1+json

Pros: Clean URLs
Cons: Harder to test, less visible
```

**Query Parameter:**
```
/api/users?version=1

Pros: Simple
Cons: Can be ignored, cache issues
```

### Rate Limiting Headers

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1643814000
Retry-After: 60
```

**When rate limited:**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1643814000
Retry-After: 60

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds."
  }
}
```

### Security Best Practices

**Authentication:**
```
# Bearer Token (JWT)
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Key
X-API-Key: your-api-key-here

# Basic Auth (only over HTTPS)
Authorization: Basic dXNlcjpwYXNzd29yZA==
```

**HTTPS Only:**
```
# Redirect HTTP to HTTPS
# Use HSTS header
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**CORS Configuration:**
```javascript
// Allow specific origins
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

**Input Validation:**
```javascript
// ✅ Good: Validate all inputs
app.post('/users', (req, res) => {
  const schema = {
    email: Joi.string().email().required(),
    age: Joi.number().min(18).max(120),
    name: Joi.string().max(100).required()
  };
  
  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message
      }
    });
  }
  
  // Process validated data
});
```

---

## GraphQL API Design

### Schema Design

**Good Schema Design:**
```graphql
type User {
  id: ID!
  email: String!
  name: String!
  age: Int
  posts(first: Int, after: String): PostConnection!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments(first: Int, after: String): CommentConnection!
  publishedAt: DateTime
}

type Comment {
  id: ID!
  text: String!
  author: User!
  post: Post!
  createdAt: DateTime!
}

# Relay-style pagination
type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type PostEdge {
  node: Post!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Queries
type Query {
  user(id: ID!): User
  users(
    first: Int
    after: String
    filter: UserFilter
  ): UserConnection!
  
  post(id: ID!): Post
  posts(
    first: Int
    after: String
    filter: PostFilter
  ): PostConnection!
}

input UserFilter {
  status: UserStatus
  role: UserRole
  createdAfter: DateTime
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

# Mutations
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

input CreateUserInput {
  email: String!
  name: String!
  age: Int
}

type CreateUserPayload {
  user: User!
  errors: [Error!]
}

type Error {
  field: String
  message: String!
}
```

### Resolvers

**Efficient Resolver with DataLoader:**
```javascript
// Without DataLoader (N+1 problem)
const resolvers = {
  Post: {
    author: async (post) => {
      // ❌ Separate query for each post!
      return db.getUser(post.authorId);
    }
  }
};

// With DataLoader (batched)
const userLoader = new DataLoader(async (userIds) => {
  // ✅ Single query for all users!
  const users = await db.getUsers(userIds);
  return userIds.map(id => users.find(u => u.id === id));
});

const resolvers = {
  Post: {
    author: async (post, args, context) => {
      return context.loaders.user.load(post.authorId);
    }
  }
};
```

### Query Complexity Limits

```javascript
const { createComplexityLimitRule } = require('graphql-validation-complexity');

const server = new ApolloServer({
  schema,
  validationRules: [
    createComplexityLimitRule(1000, {
      onCost: (cost) => {
        console.log('Query cost:', cost);
      }
    })
  ]
});
```

### Rate Limiting

```javascript
const { createRateLimitDirective } = require('graphql-rate-limit-directive');

const typeDefs = `
  directive @rateLimit(
    max: Int!
    window: String!
  ) on FIELD_DEFINITION

  type Query {
    users: [User!]! @rateLimit(max: 100, window: "1m")
    posts: [Post!]! @rateLimit(max: 50, window: "1m")
  }
`;
```

---

## gRPC API Design

### Protocol Buffers Definition

**user.proto:**
```protobuf
syntax = "proto3";

package user.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

service UserService {
  // Unary RPC
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
  
  // Server streaming
  rpc ListUsers(ListUsersRequest) returns (stream User);
  
  // Client streaming
  rpc BatchCreateUsers(stream CreateUserRequest) returns (BatchCreateUsersResponse);
  
  // Bidirectional streaming
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
  int32 age = 4;
  UserStatus status = 5;
  google.protobuf.Timestamp created_at = 6;
}

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_INACTIVE = 2;
  USER_STATUS_SUSPENDED = 3;
}

message GetUserRequest {
  string id = 1;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
  int32 age = 3;
}

message UpdateUserRequest {
  string id = 1;
  string email = 2;
  string name = 3;
  int32 age = 4;
}

message DeleteUserRequest {
  string id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  UserFilter filter = 3;
}

message UserFilter {
  UserStatus status = 1;
  google.protobuf.Timestamp created_after = 2;
}

message BatchCreateUsersResponse {
  repeated User users = 1;
  int32 created_count = 2;
}

message ChatMessage {
  string user_id = 1;
  string text = 2;
  google.protobuf.Timestamp sent_at = 3;
}
```

### Error Handling

```javascript
const grpc = require('@grpc/grpc-js');

function getUserHandler(call, callback) {
  const userId = call.request.id;
  
  userRepository.getById(userId)
    .then(user => {
      if (!user) {
        // Return NOT_FOUND error
        callback({
          code: grpc.status.NOT_FOUND,
          message: `User ${userId} not found`
        });
      } else {
        callback(null, user);
      }
    })
    .catch(error => {
      // Return INTERNAL error
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error',
        details: error.message
      });
    });
}
```

**gRPC Status Codes:**
```
OK (0)                  # Success
CANCELLED (1)           # Operation cancelled
INVALID_ARGUMENT (3)    # Invalid argument
NOT_FOUND (5)          # Resource not found
ALREADY_EXISTS (6)     # Resource already exists
PERMISSION_DENIED (7)   # Permission denied
UNAUTHENTICATED (16)   # Not authenticated
RESOURCE_EXHAUSTED (8) # Rate limit exceeded
UNIMPLEMENTED (12)     # Method not implemented
INTERNAL (13)          # Internal server error
UNAVAILABLE (14)       # Service unavailable
DEADLINE_EXCEEDED (4)  # Request timeout
```

---

## API Documentation

### OpenAPI (Swagger)

```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
  description: API for managing users

servers:
  - url: https://api.example.com/v1

paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
    
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
          format: email
        name:
          type: string
        age:
          type: integer
          minimum: 18
        created_at:
          type: string
          format: date-time
    
    CreateUserRequest:
      type: object
      required:
        - email
        - name
      properties:
        email:
          type: string
          format: email
        name:
          type: string
        age:
          type: integer
    
    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        pages:
          type: integer
```

This guide provides comprehensive patterns for designing production-ready APIs across REST, GraphQL, and gRPC.
