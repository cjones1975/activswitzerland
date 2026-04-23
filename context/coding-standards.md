# Coding Standards — TheOakCellar

---

## TypeScript

- Strict mode enabled (`"strict": true`)
- No `any` types — use proper typing or `unknown`
- Define interfaces for:
  - API responses
  - DTOs
  - database models
- Prefer type inference where obvious, explicit types where clarity is needed


---

## Angular (Frontend)

- Use **standalone components** (no NgModules)
- Use **functional, reactive patterns** (RxJS + signals where applicable)
- Keep components small and focused (single responsibility)

### Structure

- Smart components (containers): handle data + orchestration
- Presentational components: handle UI only

### Best Practices

- Use `OnPush` change detection by default
- Use reactive forms (`FormGroup`, `FormControl`)
- Avoid logic in templates
- Extract reusable logic into services

---

## State & Data Handling

- Use Angular services for:
  - API communication
  - shared state
- Avoid global state libraries unless necessary
- Prefer:
  - RxJS streams
  - component-level state

---

## UI (PrimeNG + Tailwind)

- Use **PrimeNG components** for UI building blocks
- Use **Tailwind CSS v4** for layout and styling

### Rules

- No inline styles
- Prefer utility classes over custom CSS
- Use consistent spacing scale
- Dark mode first

### Layout

- Drawer-based UI (filters, menus)
- Mobile-first design (Capacitor target)

---

## External APIs

- All third-party API calls must go through service layers
- Never call external APIs directly from controllers
- Normalize external responses before returning to frontend
- Use timeouts and retries where appropriate
- Cache expensive responses where useful
- Handle provider failures gracefully

---

## Maps & Geo Data

- Store coordinates consistently as { lat, lng }
- Use meters/km consistently
- Radius filtering should be handled in services
- Never hardcode map provider logic into components
- Wrap map interactions in Angular services/components

---


## Node.js / Express (Backend)

- Follow Express.js and Node.js coding standards and best practices.
- Use asynchronous programming techniques (async/await, Promises) for non-blocking operations.
- Prioritize security best practices to prevent common web vulnerabilities.
- Use descriptive variable and function names.
- Structure your application in a modular way using Express.js middleware and route handlers.

Express.js/Node.js

- Use Express.js middleware for request processing, authentication, and other common tasks.
- Implement RESTful APIs using Express.js routing.
- Utilize environment variables for configuration management.
- Use appropriate HTTP status codes for responses.
- Implement logging and error handling middleware.
- Use Express.js's built-in methods for handling different HTTP methods (GET, POST, PUT, DELETE).

Security Best Practices

- Use HTTPS to encrypt data in transit.
- Validate and sanitize user input to prevent injection attacks (e.g., SQL injection, XSS).
- Implement authentication and authorization to protect resources.
- Use helmet middleware to secure HTTP headers.
- Protect against common web vulnerabilities such as CSRF and clickjacking.
- Rate limit API requests to prevent abuse.

Dependencies

- Node.js (latest LTS version)
- Express.js
- npm or yarn for package management
- nodemon for development (optional, for automatic server restarts)
- body-parser, cors, helmet, morgan, etc. (as needed)

Express.js Best Practices

- Structure your application using the MVC (Model-View-Controller) pattern.
- Use middleware for common tasks such as authentication, logging, and error handling.
- Implement proper error handling using try-catch blocks and error handling middleware.
- Use environment variables for configuration management.
- Implement logging for debugging and monitoring.
- Write unit tests and integration tests using testing frameworks such as Jest or Mocha.
- Use version control (e.g., Git) to track changes.

Key Conventions

1. Follow RESTful API design principles for creating APIs.
2. Use middleware for request processing and common tasks.
3. Implement proper error handling and logging.
4. Use environment variables for configuration.
5. Write unit tests and integration tests.


### Principles

- Controllers:
  - Handle request/response only
- Services:
  - Contain business logic
- Models:
  - Define Mongoose schemas

---

## MongoDB (Mongoose)

- Use Mongoose schemas for all collections
- Use references (`ObjectId`) for relations
- Index location-related fields where useful
- Index userId on trips/reviews
- Use timestamps on all collections
- Denormalize cached attraction snapshots if useful

### Rules

- No raw Mongo queries in controllers
- Always validate input before DB operations
- Use lean queries where possible (`.lean()`)

---

## Authentication

- User credentials stored in DB


### Backend

- Validate JWT token on every request
- Use middleware:

authMiddleware -> verify token -> attach user to request

---

## Error Handling

Error handling must be consistent across both backend and frontend.

---

### Backend (Node / Express)

- Use centralized error-handling middleware
- Controllers should not contain heavy error logic
- Pass errors using `next(error)`
- Never expose stack traces to clients
- Log unexpected errors for debugging

### HTTP Status Codes

- 400 → validation error
- 401 → unauthorized
- 403 → forbidden
- 404 → not found
- 409 → conflict
- 500 → internal error

### Standard Backend Response

{
  success: false,
  error: "User-friendly error message"
}

---

## Code Quality

- No commented-out code unless necessary
- No unused imports or variables
- Keep functions small (<50 lines where possible)
- Prefer readability over cleverness
- Avoid deeply nested logic
- Each function should have a single responsibility
- Do not silently swallow errors
