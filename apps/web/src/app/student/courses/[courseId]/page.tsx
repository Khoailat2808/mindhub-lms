"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCoursePath, getCourses } from "@/features/student/api";
import { EmptyState, LessonList, LoadingState, ProgressBar, SectionCard } from "@/features/student/components";
import type { CourseCardData, LessonProgress, PathItem } from "@/features/student/types";
import { percent } from "@/features/student/utils";

export default function StudentCourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId);
  const [course, setCourse] = useState<CourseCardData | null>(null);
  const [path, setPath] = useState<PathItem[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCourses(), getCoursePath(courseId)])
      .then(([courseData, pathData]) => {
        setCourse(courseData.courses.find((item) => item.course.id === courseId) ?? null);
        setPath(pathData.path);
        setProgress(pathData.progress);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được khóa học."))
      .finally(() => setLoading(false));
  }, [courseId]);

  const chapterProgress = useMemo(() => {
    if (!course) {
      return 0;
    }
    return percent(course.completedLessons, course.totalLessons);
  }, [course]);

  if (loading) {
    return <LoadingState label="Đang mở khóa học..." />;
  }

  if (message || !course) {
    return <EmptyState title="Không tìm thấy khóa học" description={message ?? "Khóa học này chưa được gán cho bạn."} />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] bg-white p-6 shadow-sm md:p-8">
        <Link className="text-sm font-bold text-brandOrange" href="/student/courses">
          Quay lại khóa học
        </Link>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brandOrange">{course.course.subject.name}</p>
            <h2 className="mt-2 text-3xl font-bold text-brand md:text-4xl">{course.course.title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#66758d]">{course.course.description}</p>
            <p className="mt-4 text-sm font-bold text-[#536179]">Giáo viên: {course.course.teacherName ?? "MindHub Coach"}</p>
          </div>
          <div className="rounded-3xl bg-[#f4f8ff] p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-bold text-[#66758d]">Tiến độ khóa học</p>
                <p className="mt-2 text-4xl font-bold text-brand">{chapterProgress}%</p>
              </div>
              <p className="text-sm font-bold text-brandOrange">
                {course.completedLessons}/{course.totalLessons} bài
              </p>
            </div>
            <div className="mt-5">
              <ProgressBar value={chapterProgress} />
            </div>
          </div>
        </div>
      </section>

      <SectionCard title="Danh sách chương/bài học">
        <LessonList courseId={courseId} path={path} progress={progress} />
      </SectionCard>
    </div>
  );
}
