"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getProgress } from "@/features/student/api";
import type { StudentProgressResponse } from "@/features/student/api";
import { EmptyState, LoadingState, ProgressBar, SectionCard, StatCard } from "@/features/student/components";
import { formatDateTime } from "@/features/student/utils";

export default function StudentProgressPage() {
  const [data, setData] = useState<StudentProgressResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getProgress()
      .then(setData)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được tiến độ."));
  }, []);

  if (!data && !message) {
    return <LoadingState label="Đang tính tiến độ học tập..." />;
  }

  if (message || !data) {
    return <EmptyState title="Không tải được tiến độ" description={message ?? "Vui lòng thử lại sau."} />;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard helper="Bài học hoàn thành" label="Hoàn thành" value={data.stats.completedLessons} />
        <StatCard helper="Bài học trong lộ trình" label="Được giao" value={data.stats.assignedLessons} />
        <StatCard helper="Duy trì động lực tích cực" label="Streak" value={data.stats.currentStreak} />
        <StatCard helper="Tích lũy qua hoạt động học" label="XP" value={data.stats.xp} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Tiến độ theo môn">
          <div className="space-y-5">
            {data.subjects.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu môn học" description="Hãy bắt đầu bài đầu tiên để MindHub ghi nhận tiến độ." />
            ) : (
              data.subjects.map((subject) => (
                <div key={subject.subject}>
                  <div className="mb-2 flex justify-between text-sm font-bold text-[#536179]">
                    <span>{subject.subject}</span>
                    <span>{subject.completedLessons}/{subject.totalLessons} bài</span>
                  </div>
                  <ProgressBar value={subject.percentage} />
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Gợi ý học tiếp theo">
          <div className="space-y-3">
            {data.recommendations.length === 0 ? (
              <EmptyState title="Bạn đang đi rất tốt" description="Không còn bài chưa hoàn thành trong lộ trình hiện tại." />
            ) : (
              data.recommendations.map((lesson) => (
                <Link
                  className="block rounded-3xl border border-[#d8e5f6] bg-[#f8fbff] p-4 transition hover:border-brandOrange"
                  href={`/student/courses/${lesson.course.id}/lessons/${lesson.id}`}
                  key={lesson.id}
                >
                  <p className="font-bold text-brand">{lesson.title}</p>
                  <p className="mt-1 text-sm text-[#66758d]">{lesson.course.title}</p>
                </Link>
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Hoạt động gần đây">
        <div className="space-y-3">
          {data.recentActivities.length === 0 ? (
            <EmptyState title="Chưa có hoạt động" description="Hoạt động hoàn thành bài học sẽ xuất hiện tại đây." />
          ) : (
            data.recentActivities.map((activity) => (
              <div className="rounded-3xl bg-[#f8fbff] p-4" key={activity.lessonId}>
                <p className="font-bold text-brand">{activity.lesson.title}</p>
                <p className="mt-1 text-sm text-[#66758d]">
                  {activity.completed ? "Đã hoàn thành" : "Đang học"} · {formatDateTime(activity.completedAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
