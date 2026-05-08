-- CreateTable
CREATE TABLE "course_students" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "course_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_students_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "course_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "course_students_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Backfill existing course access from assigned lessons without deleting or changing existing learning paths.
INSERT OR IGNORE INTO "course_students" ("course_id", "student_id", "assigned_by", "created_at")
SELECT "lessons"."course_id", "learning_paths"."student_id", MIN("learning_paths"."assigned_by"), CURRENT_TIMESTAMP
FROM "learning_paths"
INNER JOIN "lessons" ON "lessons"."id" = "learning_paths"."lesson_id"
GROUP BY "lessons"."course_id", "learning_paths"."student_id";

-- CreateIndex
CREATE UNIQUE INDEX "course_students_course_id_student_id_key" ON "course_students"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "course_students_student_id_idx" ON "course_students"("student_id");

-- CreateIndex
CREATE INDEX "course_students_assigned_by_idx" ON "course_students"("assigned_by");
