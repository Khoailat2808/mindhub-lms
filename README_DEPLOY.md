# MindHub LMS Deployment Guide

This guide deploys the MVP as two Node services: Express API and Next.js web.

## Required Environment Variables

API:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
JWT_SECRET="generate-a-long-random-secret"
JWT_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN="https://your-web-domain.com"
UPLOAD_VIDEO_DIR="/data/uploads/videos"
UPLOAD_MATERIAL_DIR="/data/uploads/materials"
UPLOAD_QUESTION_IMAGE_DIR="/data/uploads/question-images"
MAX_VIDEO_UPLOAD_MB=100
MAX_MATERIAL_UPLOAD_MB=20
MAX_LESSON_MATERIALS_TOTAL_MB=50
MAX_QUESTION_IMAGE_UPLOAD_MB=5
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
CLOUDINARY_FOLDER="mindhub/question-images"
ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@your-domain.com"
ADMIN_PASSWORD="replace-before-public-use"
```

Web:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL="https://your-api-domain.com/api"
```

## Build Locally

```bash
npm install
npm run db:migrate
npm run db:seed
npm run build
```

## Start Production Locally

Use two terminals:

```bash
npm run start --workspace @lms/api
npm run start --workspace @lms/web
```

The API serves on `PORT` and the web app serves with Next.js defaults unless `PORT` is set for the web process.

## Database Migration and Seed

For first deploy:

```bash
npm run db:migrate
npm run db:seed
```

For later production deploys, prefer Prisma deploy migrations from the API workspace:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Only run seed in production when you intentionally want demo data. The seed script refuses production by default; set `ALLOW_PRODUCTION_SEED=true` only for an intentional demo reset. Change `ADMIN_PASSWORD` before seeding any public environment.

## Docker Compose

Copy `.env.example` to `.env.production`, update secrets/domains, then:

```bash
docker compose --env-file .env.production up --build -d
docker compose exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose exec api npm run db:seed --workspace @lms/api
```

The compose file stores PostgreSQL data and local development uploads in named volumes.

## Railway Deployment

Railway works well for this MVP with a Railway PostgreSQL plugin/database and Cloudinary for question images.

Create a Railway project with two empty services:

- `mindhub-api`
- `mindhub-web`

For `mindhub-api` service settings:

- Root Directory: leave empty / repository root (`/`)
- Config file path: `/railway.api.json`
- Add a Railway PostgreSQL database and connect its `DATABASE_URL` to this service.
- A volume at `/data` is optional for local video/material uploads, but question images should use Cloudinary in production.
- Public networking enabled
- Variables:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN=https://<mindhub-web>.up.railway.app
UPLOAD_VIDEO_DIR=/data/uploads/videos
UPLOAD_MATERIAL_DIR=/data/uploads/materials
UPLOAD_QUESTION_IMAGE_DIR=/data/uploads/question-images
MAX_VIDEO_UPLOAD_MB=100
MAX_MATERIAL_UPLOAD_MB=20
MAX_LESSON_MATERIALS_TOTAL_MB=50
MAX_QUESTION_IMAGE_UPLOAD_MB=5
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
CLOUDINARY_FOLDER=mindhub/question-images
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@mindhub.test
ADMIN_PASSWORD=<temporary-strong-password>
```

For `mindhub-web` service settings:

- Root Directory: leave empty / repository root (`/`)
- Config file path: `/railway.web.json`
- Public networking enabled
- Variables:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://<mindhub-api>.up.railway.app/api
```

Deploy with Railway CLI after logging in and linking each service:

```bash
railway up --service mindhub-api
railway up --service mindhub-web
```

After the API deploys, migrations run through `start:railway`. You can also run them manually from the Railway shell:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run db:seed --workspace @lms/api
```

Only run seed while this is a demo database. It resets demo data and requires `ALLOW_PRODUCTION_SEED=true` when `NODE_ENV=production`.

## Suggested Hosting

- Small VPS: Docker Compose behind Nginx, easiest for SQLite uploads.
- Render/Fly.io/Railway: deploy API and web as separate services, use managed PostgreSQL for application data, and use Cloudinary/S3/Supabase Storage for production images.
- Vercel for web plus VPS/Render for API works, but remember to set `NEXT_PUBLIC_API_BASE_URL` and CORS correctly.

## Nginx Reverse Proxy Example

```nginx
server {
  listen 80;
  server_name api.example.com;

  client_max_body_size 120m;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name lms.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Put HTTPS in front of both domains before public beta.

## Post-Deploy Checklist

- Open `/login` over HTTPS.
- Login as Admin, Teacher, Student.
- Confirm Student cannot open `/admin` or `/teacher`.
- Confirm Teacher cannot open `/admin`.
- Create a course/lesson/assignment as Teacher.
- Submit an assignment as Student and grade it as Teacher.
- Check API health at `/api/health`.
- Check upload size/type limits.
- Confirm `.env` and database files are not publicly served.
- Rotate demo passwords before sharing the URL.
