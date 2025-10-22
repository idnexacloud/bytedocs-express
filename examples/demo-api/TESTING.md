# Testing ByteDocs Demo API

## Current Status

✅ **FIXED**: Template loading issue resolved
✅ **FIXED**: Route detection improved for nested routers

## How to Test

### 1. Restart the Server

Stop the current server (Ctrl+C) and restart:

```bash
cd /root/bytedocs-node/express/examples/demo-api
npm run dev
```

You should see output like:
```
[ByteDocs] Detected X routes
```

### 2. Test in Browser

Open: `http://localhost:3000/docs`

You should now see:
- ✅ All API endpoints listed
- ✅ Grouped by tags (System, Users, Products)
- ✅ Complete documentation for each endpoint

### 3. Expected Routes

**System**
- GET /api/health
- GET /api/info

**Users**
- GET /api/users
- GET /api/users/:id
- POST /api/users
- PUT /api/users/:id
- PATCH /api/users/:id
- DELETE /api/users/:id

**Products**
- GET /api/products
- GET /api/products/:id
- POST /api/products
- PUT /api/products/:id
- PATCH /api/products/:id
- DELETE /api/products/:id

**Total**: ~14 endpoints

### 4. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Get all users
curl http://localhost:3000/api/users

# Get specific user
curl http://localhost:3000/api/users/1

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","fullName":"Test User"}'

# Get all products
curl http://localhost:3000/api/products

# Filter products
curl "http://localhost:3000/api/products?category=Electronics"
```

### 5. Test OpenAPI Spec

```bash
# Get OpenAPI JSON
curl http://localhost:3000/docs/openapi.json

# Pretty print
curl http://localhost:3000/docs/openapi.json | jq
```

### 6. Test with Authentication

Edit `.env`:
```
BYTEDOCS_AUTH_ENABLED=true
BYTEDOCS_AUTH_PASSWORD=demo123
```

Restart server, then visit `http://localhost:3000/docs`

You'll be redirected to login page. Enter password: `demo123`

## Debugging

If routes still don't appear, check console output for:
```
[ByteDocs] Detected X routes
```

If X = 0, it means routes aren't being detected. Check:
1. Routes are mounted BEFORE ByteDocs setup
2. App structure uses standard Express patterns

## Known Issues

None at the moment! Everything should work now.

## Next Steps

1. ✅ Try adding new routes - they'll auto-appear in docs
2. ✅ Test authentication feature
3. ✅ Customize JSDoc comments
4. ✅ Export OpenAPI spec to other tools (Postman, Insomnia, etc.)
