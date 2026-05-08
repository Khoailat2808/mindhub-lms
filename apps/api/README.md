# API

Express.js + TypeScript REST API for the LMS Coach MVP.

## Structure

```text
src/
  server.ts      HTTP server bootstrap
  app.ts         Express app configuration
  config/        Environment, auth, upload, and app configuration
  controllers/   HTTP request handlers
  db/            Prisma client and database helpers
  middlewares/   Auth, role guards, upload guards, and error handling
  routes/        REST route registration
  services/      Business logic for users, courses, lessons, quizzes, paths, progress
  types/         Backend TypeScript types
  utils/         Common helpers
  validators/    Request validation helpers
prisma/          Prisma schema, migrations, and seed
uploads/         Local video/material upload storage
tests/           Backend tests
```
