# LMS Coach MVP - AI Agent Rules

## 1. Project Identity

Dự án này là LMS Coach MVP dành cho trung tâm gia sư/coaching.

MVP chạy local, không có AI, không production, không mobile app.

Core value:
- Coach tạo nội dung học tập.
- Coach gán lộ trình cá nhân cho từng học sinh.
- Học sinh học theo lộ trình được gán.
- Hệ thống theo dõi progress, streak, XP.

Không được tự ý mở rộng scope ngoài MVP nếu chưa được yêu cầu.

---

## 2. Fixed Tech Stack

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS
- @hello-pangea/dnd

Backend:
- Node.js
- Express.js
- TypeScript
- REST API

Database:
- SQLite

Auth:
- JWT Bearer Token
- bcrypt password hashing

Upload:
- multer
- uploads/videos/
- uploads/materials/

Không tự ý đổi sang framework khác.

---

## 3. Expected Project Structure

Ưu tiên cấu trúc dạng monorepo:

```txt
lms-coach-mvp/
  AGENTS.md
  README.md
  .env.example
  package.json

  apps/
    web/
      src/
        app/
        components/
        features/
        lib/
        hooks/
        types/

    api/
      src/
        server.ts
        app.ts
        config/
        routes/
        controllers/
        services/
        middlewares/
        validators/
        db/
        types/
      uploads/
        videos/
        materials/

  packages/
    shared/
      src/
        types/
        constants/
        validators/