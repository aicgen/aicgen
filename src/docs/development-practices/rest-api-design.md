# REST API Design Guidelines

## Overview

RESTful API design is an architectural approach that provides a standardized way to build web services. Poor API design creates technical debt, frustrates developers, and makes systems harder to maintain. These guidelines ensure APIs are intuitive, consistent, and maintainable.

## Core Principles

### 1. Resource-Oriented Design

**APIs are interfaces that other developers (including future you) will have to work with.**

Think in terms of **resources** (nouns - entities and their relationships) rather than **actions** (verbs - operations).

✅ **Good (Resource-Oriented):**
```
GET    /api/v1/books
POST   /api/v1/books
GET    /api/v1/books/123
PUT    /api/v1/books/123
DELETE /api/v1/books/123
```

❌ **Bad (Action-Oriented):**
```
POST /api/v1/createBook
GET  /api/v1/getBookById/123
POST /api/v1/updateBook/123
POST /api/v1/deleteBook/123
```

### 2. Use Nouns, Never Verbs in URLs

**The HTTP method conveys the action. The URL describes what exists.**

| ❌ Anti-pattern | ✅ Correct |
|-----------------|-----------|
| `POST /api/v1/createBook` | `POST /api/v1/books` |
| `GET /api/v1/getBookById/123` | `GET /api/v1/books/123` |
| `POST /api/v1/updateBook/123` | `PUT /api/v1/books/123` |
| `DELETE /api/v1/removeBook/123` | `DELETE /api/v1/books/123` |
| `GET /api/v1/fetchUserOrders` | `GET /api/v1/orders?userId=123` |

### 3. Plural Nouns for Collections

**Always use plural nouns for collections to eliminate ambiguity.**

✅ **Good:**
```
GET /api/v1/books           # Collection of books
GET /api/v1/books/123       # Single book from books collection
GET /api/v1/authors         # Collection of authors
GET /api/v1/authors/456     # Single author
```

❌ **Bad:**
```
GET /api/v1/book            # Unclear: one book or all books?
GET /api/v1/book/123        # Inconsistent
```

---

## HTTP Methods - Semantic Meaning

Each HTTP method has a specific purpose and guarantees:

### GET - Read Only
- **Purpose:** Retrieve resources
- **Guarantees:** Safe (no side effects), idempotent
- **Response:** Resource representation

```typescript
// Get collection
GET /api/v1/books
Response: { data: Book[], pagination: {...} }

// Get single resource
GET /api/v1/books/123
Response: { data: Book }
```

### POST - Create
- **Purpose:** Create new resource or complex operations
- **Guarantees:** Not idempotent (creates new resource each time)
- **Response:** 201 Created with Location header

```typescript
POST /api/v1/books
Body: { title: "The Hobbit", author: "J.R.R. Tolkien" }
Response: 201 Created
Location: /api/v1/books/123
Body: { data: { id: 123, title: "The Hobbit", ... } }
```

### PUT - Replace Entire Resource
- **Purpose:** Replace entire resource (all fields required)
- **Guarantees:** Idempotent (same result if called multiple times)
- **Response:** 200 OK or 204 No Content

```typescript
PUT /api/v1/books/123
Body: {
  title: "The Hobbit",
  author: "J.R.R. Tolkien",
  isbn: "978-0547928227",
  publishedDate: "1937-09-21",
  pages: 310
}
Response: 200 OK
```

### PATCH - Partial Update
- **Purpose:** Update specific fields (only send changed fields)
- **Guarantees:** Idempotent
- **Response:** 200 OK

```typescript
PATCH /api/v1/books/123
Body: { price: 14.99 }  // Only update price
Response: 200 OK
```

### DELETE - Remove Resource
- **Purpose:** Delete resource
- **Guarantees:** Idempotent
- **Response:** 204 No Content or 200 OK

```typescript
DELETE /api/v1/books/123
Response: 204 No Content
```

---

## URL Structure

### Standard URL Format

```
{protocol}://{host}/api/{version}/{collection}/{id}?{query_params}
```

**Examples:**
```
https://api.example.com/api/v1/books
https://api.example.com/api/v1/books/123
https://api.example.com/api/v1/authors/456/books
https://api.example.com/api/v1/books?genre=fiction&page=1&limit=20
```

### API Versioning

**Always version APIs from inception.**

✅ **Good:**
```
/api/v1/books
/api/v2/books
```

❌ **Bad:**
```
/api/books          # No version
/books              # No API prefix
/v1/books           # No API prefix
```

**Why:** Allows breaking changes without disrupting existing clients. Clients can upgrade to new versions when ready.

### Hierarchical Resources

**Use path nesting for parent-child relationships.**

✅ **Good (Clear Hierarchy):**
```
GET /api/v1/authors/456/books              # Books by specific author
POST /api/v1/authors/456/books             # Create book for author
GET /api/v1/orders/789/items               # Items in specific order
GET /api/v1/users/123/addresses            # User's addresses
```

❌ **Bad (Too Deep):**
```
GET /api/v1/publishers/1/authors/2/books/3/reviews/4/comments/5
# Too nested, hard to read and maintain
```

**Limit nesting to 2-3 levels.** Beyond that, use query parameters:

✅ **Better:**
```
GET /api/v1/comments?reviewId=4
GET /api/v1/reviews/4/comments
```

---

## Query Parameters & Filtering

### Simple Filters

**Use query parameters for straightforward filtering.**

```typescript
// Single filter
GET /api/v1/books?author=tolkien

// Multiple filters
GET /api/v1/books?author=tolkien&genre=fantasy&available=true

// Range filters
GET /api/v1/books?priceMin=10&priceMax=50&publishedAfter=2020-01-01

// Sorting
GET /api/v1/books?sortBy=publishedDate&order=desc

// Pagination
GET /api/v1/books?page=1&limit=20
```

### Complex Filters

**When filters become unwieldy, switch to POST with structured request body.**

❌ **Unwieldy Query String:**
```
GET /api/v1/books?authors=1,2,3&genres=fiction,mystery&priceMin=10&priceMax=50&publishedAfter=2020-01-01&inStock=true&formats=paperback,ebook
```

✅ **Structured Search Endpoint:**
```typescript
POST /api/v1/books/search
{
  "authors": [1, 2, 3],
  "genres": ["fiction", "mystery"],
  "priceRange": { "min": 10, "max": 50 },
  "publishedAfter": "2020-01-01",
  "inStock": true,
  "formats": ["paperback", "ebook"],
  "sortBy": "publishedDate",
  "order": "desc",
  "page": 1,
  "limit": 20
}
```

---

## Naming Conventions

### Consistency is Key

**Pick ONE style (snake_case or camelCase) and enforce it throughout the entire API.**

✅ **Consistent snake_case:**
```typescript
GET /api/v1/products?created_at=2024-01-01&price_min=50&is_available=true
POST /api/v1/users/123/shipping_addresses

{
  "product_id": 123,
  "product_name": "Widget",
  "created_at": "2024-01-01T00:00:00Z",
  "is_available": true
}
```

✅ **Consistent camelCase:**
```typescript
GET /api/v1/products?createdAt=2024-01-01&priceMin=50&isAvailable=true
POST /api/v1/users/123/shippingAddresses

{
  "productId": 123,
  "productName": "Widget",
  "createdAt": "2024-01-01T00:00:00Z",
  "isAvailable": true
}
```

❌ **Inconsistent (Never Mix):**
```typescript
GET /api/v1/products?created_at=2024-01-01&priceMin=50  // Mixed!

{
  "product_id": 123,        // snake_case
  "productName": "Widget",  // camelCase - confusing!
}
```

---

## Response Standards

### HTTP Status Codes

**Use meaningful status codes to communicate outcomes.**

| Code | Meaning | Usage |
|------|---------|-------|
| 200 OK | Success | GET, PUT, PATCH succeeded |
| 201 Created | Resource created | POST succeeded |
| 204 No Content | Success, no body | DELETE succeeded |
| 400 Bad Request | Invalid client data | Validation failed |
| 401 Unauthorized | Authentication required | No/invalid auth token |
| 403 Forbidden | Authenticated but not permitted | Insufficient permissions |
| 404 Not Found | Resource doesn't exist | Invalid ID |
| 409 Conflict | Resource conflict | Duplicate, version mismatch |
| 422 Unprocessable Entity | Semantic errors | Business rule violation |
| 500 Internal Server Error | Server failure | Unexpected error |

❌ **Don't return 200 for everything:**
```typescript
// Bad - returns 200 for errors
GET /api/v1/books/999
Response: 200 OK
{
  "success": false,
  "error": "Book not found"
}
```

✅ **Use proper status codes:**
```typescript
GET /api/v1/books/999
Response: 404 Not Found
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Book with ID 999 not found"
  }
}
```

### Success Response Format

**Wrap data in consistent structure.**

```typescript
// Single resource
GET /api/v1/books/123
Response: 200 OK
{
  "data": {
    "id": 123,
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "isbn": "978-0547928227"
  }
}

// Collection
GET /api/v1/books
Response: 200 OK
{
  "data": [
    { "id": 123, "title": "The Hobbit" },
    { "id": 124, "title": "1984" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

// Creation
POST /api/v1/books
Response: 201 Created
Location: /api/v1/books/123
{
  "data": {
    "id": 123,
    "title": "The Hobbit",
    "createdAt": "2024-12-06T10:00:00Z"
  }
}
```

### Error Response Format

**Provide structured, actionable error information.**

```typescript
// Simple error
Response: 404 Not Found
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Book with ID 999 not found"
  }
}

// Validation errors (field-level details)
Response: 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      {
        "field": "price",
        "message": "Must be a positive number",
        "value": -10
      },
      {
        "field": "isbn",
        "message": "ISBN format invalid",
        "value": "123"
      },
      {
        "field": "publishedDate",
        "message": "Must be in ISO 8601 format",
        "value": "2024/01/01"
      }
    ]
  }
}

// Business rule error
Response: 422 Unprocessable Entity
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Cannot process order: insufficient stock",
    "details": {
      "requested": 10,
      "available": 3,
      "productId": 456
    }
  }
}
```

### Pagination (Non-Optional)

**If your API returns lists, it needs pagination** - regardless of current data size.

✅ **Always paginate collections:**
```typescript
GET /api/v1/books?page=1&limit=20

Response: 200 OK
{
  "data": [
    { "id": 1, "title": "Book 1" },
    { "id": 2, "title": "Book 2" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": false
  },
  "links": {
    "self": "/api/v1/books?page=1&limit=20",
    "next": "/api/v1/books?page=2&limit=20",
    "last": "/api/v1/books?page=8&limit=20"
  }
}
```

**Common Pagination Strategies:**

1. **Offset-based (page/limit)**
   ```
   GET /api/v1/books?page=2&limit=20
   ```

2. **Cursor-based (for large datasets)**
   ```
   GET /api/v1/books?cursor=eyJpZCI6MTIzfQ&limit=20
   ```

3. **Keyset pagination (efficient for large tables)**
   ```
   GET /api/v1/books?afterId=123&limit=20
   ```

---

## Virtual Resources

**Not all endpoints map to database tables. Handle aggregated or generated data as resources.**

```typescript
// Recommendations (generated on-demand)
GET /api/v1/users/123/recommendations
GET /api/v1/recommendations?type=trending

// Complex search
POST /api/v1/books/search
{
  "query": "fantasy",
  "filters": {...}
}

// Autocomplete/suggestions
GET /api/v1/suggestions?q=hob&type=books
Response: {
  "data": [
    { "id": 123, "title": "The Hobbit" },
    { "id": 456, "title": "Hobbit House Design" }
  ]
}

// Analytics/aggregations
GET /api/v1/analytics/sales?period=monthly&year=2024
GET /api/v1/reports/inventory?warehouseId=5
```

---

## Complete REST API Example

### Book Store System

**Entities:** Authors, Books, Customers, Orders, Order Items

**Clean Endpoints:**

```typescript
// Books
GET    /api/v1/books              // List with pagination
GET    /api/v1/books/123          // Specific book
POST   /api/v1/books              // Create
PUT    /api/v1/books/123          // Full update
PATCH  /api/v1/books/123          // Partial update
DELETE /api/v1/books/123          // Delete

// Authors
GET    /api/v1/authors
GET    /api/v1/authors/456
POST   /api/v1/authors
PUT    /api/v1/authors/456
DELETE /api/v1/authors/456

// Hierarchical (Author's books)
GET    /api/v1/authors/456/books
POST   /api/v1/authors/456/books

// Orders
GET    /api/v1/orders
GET    /api/v1/orders/789
POST   /api/v1/orders
PATCH  /api/v1/orders/789

// Order items (nested resource)
GET    /api/v1/orders/789/items
POST   /api/v1/orders/789/items
PATCH  /api/v1/orders/789/items/10
DELETE /api/v1/orders/789/items/10

// Customers
GET    /api/v1/customers
GET    /api/v1/customers/123
GET    /api/v1/customers/123/orders      // Customer's orders
GET    /api/v1/customers/123/addresses   // Customer's addresses
```

---

## Express.js Implementation Example

```typescript
import express, { Request, Response } from 'express';

const router = express.Router();

// List books with pagination
router.get('/api/v1/books', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const genre = req.query.genre as string;

  const filters: any = {};
  if (genre) filters.genre = genre;

  const { books, total } = await bookService.findAll({
    page,
    limit,
    filters
  });

  res.status(200).json({
    data: books,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// Get single book
router.get('/api/v1/books/:id', async (req: Request, res: Response) => {
  const book = await bookService.findById(req.params.id);

  if (!book) {
    return res.status(404).json({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `Book with ID ${req.params.id} not found`
      }
    });
  }

  res.status(200).json({ data: book });
});

// Create book
router.post('/api/v1/books', async (req: Request, res: Response) => {
  const validationErrors = validateBook(req.body);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid data',
        details: validationErrors
      }
    });
  }

  const book = await bookService.create(req.body);

  res.status(201)
    .location(`/api/v1/books/${book.id}`)
    .json({ data: book });
});

// Update book (full replacement)
router.put('/api/v1/books/:id', async (req: Request, res: Response) => {
  const book = await bookService.update(req.params.id, req.body);

  if (!book) {
    return res.status(404).json({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `Book with ID ${req.params.id} not found`
      }
    });
  }

  res.status(200).json({ data: book });
});

// Partial update
router.patch('/api/v1/books/:id', async (req: Request, res: Response) => {
  const book = await bookService.partialUpdate(req.params.id, req.body);

  if (!book) {
    return res.status(404).json({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `Book with ID ${req.params.id} not found`
      }
    });
  }

  res.status(200).json({ data: book });
});

// Delete book
router.delete('/api/v1/books/:id', async (req: Request, res: Response) => {
  const deleted = await bookService.delete(req.params.id);

  if (!deleted) {
    return res.status(404).json({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `Book with ID ${req.params.id} not found`
      }
    });
  }

  res.status(204).send();
});

// Complex search
router.post('/api/v1/books/search', async (req: Request, res: Response) => {
  const { books, total } = await bookService.search(req.body);

  res.status(200).json({
    data: books,
    pagination: {
      page: req.body.page || 1,
      limit: req.body.limit || 20,
      total,
      totalPages: Math.ceil(total / (req.body.limit || 20))
    }
  });
});
```

---

## Common Pitfalls

❌ **Verbs in URLs:** `/api/createUser`, `/api/getBooks`
❌ **Singular collections:** `/api/book` instead of `/api/books`
❌ **Returning 200 for errors:** Always use proper status codes
❌ **No pagination:** Will cause performance issues as data grows
❌ **Inconsistent naming:** Mixing snake_case and camelCase
❌ **Too deep nesting:** `/publishers/1/authors/2/books/3/reviews/4`
❌ **No versioning:** `/api/books` instead of `/api/v1/books`
❌ **Generic errors:** "Error occurred" without details
❌ **No field-level validation errors:** Hard to debug for clients

---

## Key Takeaways

1. **Resource-oriented design:** Use nouns, not verbs
2. **HTTP methods matter:** GET, POST, PUT, PATCH, DELETE have specific meanings
3. **Version from day one:** `/api/v1/`
4. **Always paginate:** Even if data is small now
5. **Meaningful status codes:** Don't return 200 for everything
6. **Structured errors:** Provide actionable error messages with field-level details
7. **Consistency wins:** Pick naming convention and stick to it
8. **Hierarchical resources:** Use nesting wisely (2-3 levels max)
9. **Query for simple filters, POST for complex:** Don't create unwieldy query strings

**Remember:** APIs are interfaces that other developers (including future you) will use. Invest time in good design upfront to avoid technical debt.
