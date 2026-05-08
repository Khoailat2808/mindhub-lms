"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getDashboard } from "@/features/student/api";
import {
  AssignmentCard,
  EmptyState,
  LoadingState,
  ProgressBar,
  SectionCard,
  StatCard
} from "@/features/student/components";
import type { DashboardResponse } from "@/features/student/api";
import { formatDateTime, percent } from "@/features/student/utils";

export default function StudentDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được dashboard."));
  }, []);

  const continueLesson = useMemo(() => {
    return data?.path[0] ?? null;
  }, [data]);

  if (!data && !message) {
    return <LoadingState label="Đang tổng hợp tình hình học tập..." />;
  }

  if (message) {
    return <EmptyState title="Chưa tải được dữ liệu" description={message} />;
  }

  const overall = percent(data!.stats.completedLessons, data!.stats.assignedLessons);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] bg-brand text-white shadow-[0_22px_70px_rgba(8,47,111,0.18)]">
        <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr] md:p-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#ffcfab]">MindHub Learning Space</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
              Chào mừng bạn quay lại, sẵn sàng mở khóa một ý tưởng mới hôm nay?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#dbe8ff]">
              Mỗi bài học là một bước nhỏ trên hành trình tư duy. MindHub ở đây để giúp bạn học chắc, hiểu sâu và tiến bộ đều.
            </p>
          </div>
          <div className="rounded-3xl bg-white/12 p-5">
            <p className="text-sm font-semibold text-[#dbe8ff]">Tiến độ tổng quan</p>
            <p className="mt-3 text-5xl font-bold">{overall}%</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-brandOrange" style={{ width: `${overall}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard helper="Khóa/bài được gán trong lộ trình" label="Bài học được giao" value={data!.stats.assignedLessons} />
        <StatCard helper="Những bài đã hoàn thành trọn vẹn" label="Đã hoàn thành" value={data!.stats.completedLessons} />
        <StatCard helper="Điểm trung bình từ các quiz" label="Điểm trung bình" value={`${data!.stats.averageScore}%`} />
        <StatCard helper="Duy trì nhịp học đều" label="XP hiện tại" value={data!.stats.xp} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Tiếp tục học">
          {continueLesson ? (
            <div>
              <p className="text-sm font-bold text-brandOrange">{continueLesson.lesson.course.subject.name}</p>
              <h3 className="mt-2 text-2xl font-bold text-brand">{continueLesson.lesson.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66758d]">{continueLesson.lesson.description}</p>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm font-bold text-[#536179]">
                  <span>Lộ trình hiện tại</span>
                  <span>{overall}%</span>
                </div>
                <ProgressBar value={overall} />
              </div>
              <Link
                className="mt-6 inline-flex rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-[#06265a]"
                href={`/student/courses/${continueLesson.lesson.course.id}/lessons/${continueLesson.lesson.id}`}
              >
                Tiếp tục học
              </Link>
            </div>
          ) : (
            <EmptyState title="Chưa có bài học gần nhất" description="Coach sẽ gán lộ trình học để bạn bắt đầu." />
          )}
        </SectionCard>

        <SectionCard title="Lịch học sắp tới">
          <div className="space-y-3">
            {data!.schedule.length === 0 ? (
              <EmptyState title="Lịch đang trống" description="Khi có buổi học mới, MindHub sẽ đặt ở đây." />
            ) : (
              data!.schedule.map((item) => (
                <div className="rounded-2xl bg-[#f5f9ff] p-4" key={item.id}>
                  <p className="font-bold text-brand">{item.title}</p>
                  <p className="mt-1 text-sm text-[#66758d]">{formatDateTime(item.startsAt)}</p>
                  <p className="mt-1 text-sm text-[#66758d]">{item.location}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard action={<Link className="text-sm font-bold text-brandOrange" href="/student/assignments">Xem tất cả</Link>} title="Nhiệm vụ hôm nay">
          <div className="space-y-4">
            {data!.assignments.length === 0 ? (
              <EmptyState title="Không có nhiệm vụ" description="Hôm nay bạn có thể ôn lại các bài đã học." />
            ) : (
              data!.assignments.slice(0, 2).map((assignment) => (
                <AssignmentCard assignment={assignment} key={assignment.id} />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Thông báo mới">
          <div className="space-y-3">
            {data!.notifications.length === 0 ? (
              <EmptyState title="Chưa có thông báo" description="Các cập nhật từ coach sẽ xuất hiện ở đây." />
            ) : (
              data!.notifications.map((item) => (
                <div className="rounded-2xl border border-[#e0eaf7] bg-[#f8fbff] p-4" key={item.id}>
                  <p className="font-bold text-brand">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#66758d]">{item.content}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
