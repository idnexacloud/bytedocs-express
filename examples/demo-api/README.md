# ByteDocs Demo API

A complete demo Express API showcasing ByteDocs Express automatic documentation features.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install Express and link to the local `bytedocs-express` package using `file:../../`.

### 2. Run the Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 3. Access Documentation

Open your browser and go to:
```
http://localhost:3000/docs
```

You'll see beautiful, automatically generated API documentation!

## Available Endpoints

### System Endpoints
- `GET /` - Welcome message
- `GET /api/health` - Health check
- `GET /api/info` - API information

### Users API
- `GET /api/users` - List all users (supports filtering by role and search)
- `GET /api/users/:id` - Get specific user
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `PATCH /api/users/:id` - Partially update user
- `DELETE /api/users/:id` - Delete user

### Products API
- `GET /api/products` - List all products (supports filtering by category, price, stock)
- `GET /api/products/:id` - Get specific product
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `PATCH /api/products/:id` - Partially update product
- `DELETE /api/products/:id` - Delete product

## Configuration

Edit `.env` file to customize:

```bash
# Server
PORT=3000

# ByteDocs Settings
BYTEDOCS_TITLE="Demo API Documentation"
BYTEDOCS_VERSION="1.0.0"
BYTEDOCS_AUTH_ENABLED=false  # Set to true to enable authentication

# If auth is enabled:
BYTEDOCS_AUTH_PASSWORD=demo123
```

## Testing with Authentication

To test the authentication feature:

1. Edit `.env` and set:
   ```
   BYTEDOCS_AUTH_ENABLED=true
   BYTEDOCS_AUTH_PASSWORD=demo123
   ```

2. Restart the server

3. Visit `http://localhost:3000/docs`

4. You'll be redirected to login page

5. Enter password: `demo123`

6. Access granted! Now you can view the documentation

## Test the API

### Example: Get All Users

```bash
curl http://localhost:3000/api/users
```

### Example: Create a User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "user"
  }'
```

### Example: Get All Products

```bash
curl http://localhost:3000/api/products
```

### Example: Filter Products by Category

```bash
curl "http://localhost:3000/api/products?category=Electronics"
```

## Features Demonstrated

✅ **Automatic Route Detection** - All routes are automatically discovered
✅ **JSDoc Documentation** - Documentation extracted from code comments
✅ **OpenAPI Generation** - Valid OpenAPI 3.0.3 spec at `/docs/openapi.json`
✅ **Multiple Environments** - Production, Staging, and Local URLs
✅ **Authentication** - Session-based auth with IP banning
✅ **Beautiful UI** - Interactive documentation interface
✅ **Request/Response Examples** - Auto-generated examples

## Project Structure

```
demo-api/
├── src/
│   ├── controllers/        # Business logic
│   │   ├── users.controller.ts
│   │   └── products.controller.ts
│   ├── routes/            # Route definitions
│   │   ├── index.ts
│   │   ├── users.routes.ts
│   │   └── products.routes.ts
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   └── index.ts           # Main application
├── .env                   # Configuration
├── package.json
└── tsconfig.json
```

## Next Steps

- Try adding more routes and see them automatically appear in the docs
- Test the authentication feature
- Customize the theme in `.env`
- Export the OpenAPI spec and import it into other tools
- Add more JSDoc annotations to enrich the documentation

Enjoy automatic API documentation! 🚀
