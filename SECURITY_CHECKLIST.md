# Security Checklist

## Implemented In This MVP

- JWT Bearer authentication on protected API routes.
- Role-based authorization for Admin, Teacher/Coach, and Student routes.
- Frontend redirects users to the correct dashboard when they open the wrong role area.
- Passwords are hashed with bcrypt.
- API never returns password hashes.
- Login endpoint has an in-memory rate limiter.
- API JSON body size is limited.
- Production CORS is restricted by `CORS_ORIGIN`.
- HTTP security headers are set by Express.
- Uploads are restricted by MIME type, file count, per-file size, and total lesson material size.
- Uploaded filenames are normalized and randomized.
- Student lesson, assignment, profile, notification, and schedule APIs are scoped to the authenticated student.
- Teacher course/lesson/assignment APIs are scoped to teacher-owned courses where the schema supports it.
- Admin cannot delete their own account.
- Users with learning/grading history are not hard-deleted.
- Production browser source maps are disabled in Next.js.
- `.env.example` contains placeholders only.

## Production Requirements

- Use HTTPS for both web and API.
- Set `JWT_SECRET` to a long random value and rotate it if leaked.
- Change all demo passwords before public access.
- Keep `.env`, SQLite database files, and upload storage outside the public web root.
- Set `NODE_ENV=production` and exact `CORS_ORIGIN` domains.
- Configure reverse proxy upload limits to match `MAX_VIDEO_UPLOAD_MB`.
- Back up SQLite and uploads regularly.
- Do not run seed on a real production database unless you intentionally need demo data.
- Consider moving to Postgres when usage grows beyond public beta or concurrent writes increase.
- Add external log monitoring before a larger pilot.
- Add CSRF/cookie hardening if the auth model changes from Bearer token to cookies.
