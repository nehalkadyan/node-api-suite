# Book & Author REST API with JWT Authentication

A full-featured, modular RESTful API built with **Express 5**, **Mongoose**, **JWT (jsonwebtoken)**, **bcrypt**, and **dotenv**.

---

## 🚀 Features

- **JWT Authentication & Security**:
  - User/Author registration with email format validation.
  - Secure password hashing using `bcrypt` (with automatic salt generation in Mongoose hooks).
  - Secure login with JWT issuance and password omission from responses.
  - Route protection middleware (`protect`) validating `Bearer <token>`.
  - Current user profile endpoint (`GET /api/auth/me`).
- **Book Management Routes**:
  - `POST /api/books`: Store a single book (associated with the authenticated author).
  - `POST /api/books/bulk`: Store multiple books in bulk (batch insert via `insertMany`).
  - `GET /api/books`: Retrieve all books (with optional genre filtering).
  - `GET /api/books/with-author`: Retrieve all books with full populated author details (`name`, `email`, `role`, `bio`).
  - `GET /api/books/:id`: Retrieve a specific book by its ID with populated author details.
- **Architectural Excellence**:
  - Separation of Express app (`src/app.js`) and HTTP server (`src/server.js`) for seamless testability.
  - Centralized error handler and 404 handler.
  - Fully testable with automated integration tests using **Jest** and **Supertest** with **MongoMemoryServer** (no external MongoDB required to run tests!).

---

## 📁 Project Structure

```text
├── src/
│   ├── app.js                 # Express application instance & middleware
│   ├── server.js              # Server entry point & DB startup
│   ├── config/
│   │   └── db.js              # Mongoose database connection setup
│   ├── controllers/
│   │   ├── authController.js  # Register, login, getMe controllers
│   │   └── bookController.js  # Book CRUD and bulk storage controllers
│   ├── middleware/
│   │   ├── auth.js            # JWT verification & protection middleware
│   │   └── errorHandler.js    # Global error & 404 handler
│   ├── models/
│   │   ├── User.js            # User/Author Mongoose schema with bcrypt hooks
│   │   └── Book.js            # Book Mongoose schema with author reference
│   └── routes/
│       ├── authRoutes.js      # /api/auth routes
│   └── tests/
│       ├── dbHandler.js       # In-memory MongoMemoryServer lifecycle manager
│       ├── auth.test.js       # Authentication tests (APIs 1 - 3)
│       ├── books.test.js      # Book management tests (APIs 4 - 8)
│       └── app.test.js        # Health check & 404 handler tests
├── jest.config.js             # Jest test runner configuration
├── .env.example               # Environment variables template
├── .env                       # Local environment configuration
├── api-requests.http          # Interactive HTTP requests for REST Client / Thunder Client
└── package.json
```

---

## ⚙️ Environment Variables

Configure `.env` in the root directory:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/mru_fsd_books
JWT_SECRET=super_secret_jwt_key_please_change_in_production_123456
JWT_EXPIRE=7d
```

---

## 📦 Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server** (with auto-reload):
   ```bash
   npm run dev
   ```

3. **Start in production mode**:
   ```bash
   npm start
   ```

4. **Run all automated tests**:
   ```bash
   npm test
   ```

---

## 📡 API Endpoints Overview

### 1. Authentication Routes (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a new author/user |
| `POST` | `/api/auth/login` | Public | Login with email & password, receives JWT |
| `GET` | `/api/auth/me` | Protected | Get authenticated user's profile |

#### Register (`POST /api/auth/register`)
Request Body:
```json
{
  "name": "J.K. Rowling",
  "email": "jk.rowling@example.com",
  "password": "password123",
  "role": "author",
  "bio": "British author and philanthropist"
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "id": "66f001...",
    "name": "J.K. Rowling",
    "email": "jk.rowling@example.com",
    "role": "author",
    "bio": "British author and philanthropist"
  }
}
```

#### Login (`POST /api/auth/login`)
Request Body:
```json
{
  "email": "jk.rowling@example.com",
  "password": "password123"
}
```

Response (`200 OK`):
```json
{
  "success": true,
  "message": "User logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": { ... }
}
```

---

### 2. Book Routes (`/api/books`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/books` | Protected | Store a single book (author set to logged-in user) |
| `POST` | `/api/books/bulk` | Protected | Store multiple books in bulk |
| `GET` | `/api/books` | Public | Get all books (supports `?genre=Fantasy`) |
| `GET` | `/api/books/with-author` | Public | Get all books with populated author details |
| `GET` | `/api/books/:id` | Public | Get single book by ID with author details |

#### Store Single Book (`POST /api/books`)
Header: `Authorization: Bearer <JWT_TOKEN>`  
Request Body:
```json
{
  "title": "Harry Potter and the Philosopher's Stone",
  "description": "A young wizard discovers his magical heritage.",
  "price": 19.99,
  "genre": "Fantasy",
  "publishedYear": 1997,
  "inStock": true
}
```

#### Store Multiple Books (`POST /api/books/bulk`)
Header: `Authorization: Bearer <JWT_TOKEN>`  
Request Body:
```json
{
  "books": [
    {
      "title": "Harry Potter and the Chamber of Secrets",
      "price": 21.99,
      "genre": "Fantasy",
      "publishedYear": 1998
    },
    {
      "title": "Harry Potter and the Prisoner of Azkaban",
      "price": 22.99,
      "genre": "Fantasy",
      "publishedYear": 1999
    }
  ]
}
```

#### Get All Books With Author Details (`GET /api/books/with-author`)
Response (`200 OK`):
```json
{
  "success": true,
  "count": 2,
  "message": "Fetched all books with author details successfully",
  "data": [
    {
      "_id": "66f001...",
      "title": "Harry Potter and the Philosopher's Stone",
      "description": "A young wizard discovers his magical heritage.",
      "price": 19.99,
      "genre": "Fantasy",
      "publishedYear": 1997,
      "inStock": true,
      "author": {
        "_id": "66f000...",
        "name": "J.K. Rowling",
        "email": "jk.rowling@example.com",
        "role": "author",
        "bio": "British author and philanthropist"
      },
      "createdAt": "2026-10-16T..."
    }
  ]
}
```
