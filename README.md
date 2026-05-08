# MindHub LMS MVP

MindHub is a production-oriented MVP LMS for middle and high school students learning Math, Physics, and Chemistry. It supports Admin, Teacher, and Student workflows with JWT authentication, role-based route protection, lesson paths, assignments, progress tracking, and demo seed data.

## Tech Stack

- Monorepo: npm workspaces
- Frontend: Next.js, React, TypeScript, Tailwind CSS, @hello-pangea/dnd
- Backend: Node.js, Express, TypeScript, Prisma
- Database: SQLite
- Auth: JWT Bearer token, bcrypt password hashing
- Uploads: multer, local `apps/api/uploads`

## Project Layout

```text
apps/api          Express REST API, Prisma schema/migrations, uploads
apps/web          Next.js app router frontend
packages/shared   Shared constants, DTO types, validators
docs              Product/reference documents
```

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

API: `http://localhost:4000/api`

Web: `http://localhost:3000`

Health check:

```bash
curl http://localhost:4000/api/health
```

## Main Routes

- `/login`: login page
- `/student/dashboard`: student learning dashboard
- `/student/courses`: enrolled courses and lesson path
- `/student/assignments`: assignments and submissions
- `/student/progress`: progress summary
- `/student/profile`: student profile
- `/teacher`: teacher workspace for courses, lessons, paths, assignments, grading
- `/admin`: admin dashboard and user management

## Demo Accounts

Run `npm run db:seed`, then use:

- Admin: `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your API env. With `.env.example`: `admin` / `Admin@12345`.
- Teacher: `teacher.math` / `Teacher@123`
- Teacher: `teacher.science` / `Teacher@123`
- Student: `student.anh` / `Student@123`
- Student: `student.binh` / `Student@123`
- Student: `student.chi` / `Student@123`
- Student: `student.dat` / `Student@123`
- Student: `student.em` / `Student@123`

Change all public demo passwords before opening the site to real users.

## Quality Commands

```bash
npm run typecheck
npm run lint
npm run build
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Production

See [README_DEPLOY.md](README_DEPLOY.md) for environment variables, build/start commands, Docker, migration/seed steps, and post-deploy checks.
