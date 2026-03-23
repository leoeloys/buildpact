# Best Practices — API Design

## REST Conventions
- Use nouns for resources, verbs for actions: `/users` not `/getUsers`
- Plural resource names: `/users/{id}` not `/user/{id}`
- Consistent error responses: `{ error: { code, message, details } }`
- Version in URL path: `/v1/users` (not headers)

## Request/Response
- Accept and return JSON by default
- Use HTTP status codes correctly: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 422 Unprocessable, 500 Internal Error
- Pagination: `?page=1&limit=20` with `total` in response headers
- Filter/sort: `?status=active&sort=-created_at`

## Security
- Always validate input at the boundary (never trust client data)
- Rate limit all public endpoints
- Use HTTPS only — no HTTP fallback
- Authentication via Bearer tokens, never query params
- CORS: whitelist specific origins, never `*` in production

## Documentation
- Every endpoint has: method, path, params, body schema, response schema, error codes
- Include curl examples for every endpoint
- Document rate limits and pagination behavior

## Anti-Patterns
- ✘ Never return 200 with error body — use proper status codes
- ✘ Never expose internal IDs or stack traces in responses
- ✘ Never use GET for mutations
- ✘ Never accept unbounded lists without pagination
