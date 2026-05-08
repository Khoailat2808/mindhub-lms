"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { clearSession, getStoredUser, type AuthUser } from "@/lib/api-client";
import { dashboardFor } from "@/lib/navigation";

import type { Assignment, CourseCardData, LessonProgress, PathItem } from "./types";
import { assignmentStatusLabel, cn, formatDateTime, percent } from "./utils";

const navItems = [
  { href: "/student/dashboard", label: "Tổng quan", short: "Home" },
  { href: "/student/courses", label: "Khóa học", short: "Courses" },
  { href: "/student/assignments", label: "Bài tập", short: "Tasks" },
  { href: "/student/progress", label: "Tiến độ", short: "Progress" },
  { href: "/student/profile", label: "Hồ sơ", short: "Profile" }
];

export function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setReady(true);

    if (!stored) {
      router.replace("/login");
      return;
    }

    if (stored.role !== "student") {
      router.replace(dashboardFor(stored.role));
    }
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!ready || !user || user.role !== "student") {
    return <LoadingState label="Đang mở không gian học tập..." fullScreen />;
  }

  return (
    <main className="min-h-screen bg-[#eef5ff] text-ink">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#d8e5f6] bg-white/92 px-5 py-5 shadow-[18px_0_55px_rgba(8,47,111,0.08)] backdrop-blur lg:block">
        <Link className="flex items-center gap-3" href="/student/dashboard">
          <img alt="MindHub" className="h-12 w-12 rounded-2xl object-contain" src="/brand/mindhub-logo.png" />
          <div>
            <p className="text-lg font-bold text-brand">MindHub</p>
            <p className="text-xs font-medium text-[#66758d]">Người bạn đồng hành trên hành trình tư duy</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  active
                    ? "bg-brand text-white shadow-[0_12px_24px_rgba(8,47,111,0.2)]"
                    : "text-[#536179] hover:bg-[#f0f6ff] hover:text-brand"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-5 bottom-5 rounded-3xl bg-[#f4f8ff] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.fullName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.fullName}</p>
              <p className="truncate text-xs text-[#66758d]">{user.email}</p>
            </div>
          </div>
          <button
            className="mt-4 w-full rounded-2xl border border-[#d8e5f6] bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:border-brandOrange"
            onClick={handleLogout}
            type="button"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      <section className="pb-24 lg:ml-72 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-[#d8e5f6] bg-[#eef5ff]/86 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-brandOrange">MindHub Student</p>
              <h1 className="truncate text-xl font-bold text-brand">Chào mừng bạn quay lại, {user.fullName}</h1>
            </div>
            <div className="hidden min-w-[280px] items-center rounded-2xl border border-[#d8e5f6] bg-white px-4 py-3 text-sm text-[#7c889b] md:flex">
              Tìm khóa học, bài học, bài tập...
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand shadow-sm sm:inline-flex">
                Thông báo
              </span>
              <Avatar name={user.fullName} />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#d8e5f6] bg-white px-2 py-2 shadow-[0_-10px_34px_rgba(8,47,111,0.12)] lg:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              className={cn(
                "rounded-2xl px-1 py-2 text-center text-[11px] font-bold",
                active ? "bg-brand text-white" : "text-[#68758b]"
              )}
              href={item.href}
              key={item.href}
            >
              {item.short}
            </Link>
          );
        })}
      </nav>
    </main>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = useMemo(
    () =>
      name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [name]
  );

  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-sm font-bold text-white">
      {initials}
    </div>
  );
}

export function SectionCard({
  children,
  className,
  title,
  action
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl border border-[#d8e5f6] bg-white p-5 shadow-sm", className)}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-bold text-brand">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#dfeaf9]">
      <div className="h-full rounded-full bg-brandOrange transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function StatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-3xl border border-[#d8e5f6] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#66758d]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-brand">{value}</p>
      <p className="mt-2 text-sm text-[#66758d]">{helper}</p>
    </div>
  );
}

export function CourseCard({ item }: { item: CourseCardData }) {
  const progress = percent(item.completedLessons, item.totalLessons);
  const status = progress === 100 ? "Hoàn thành" : progress > 0 ? "Đang học" : "Chưa bắt đầu";

  return (
    <Link
      className="group block rounded-3xl border border-[#d8e5f6] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brandOrange hover:shadow-[0_18px_45px_rgba(8,47,111,0.12)]"
      href={`/student/courses/${item.course.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-2xl bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-brand">{item.course.subject.name}</span>
        <span className="rounded-2xl bg-[#fff3e8] px-3 py-1 text-xs font-bold text-brandOrange">{status}</span>
      </div>
      <h3 className="mt-4 text-xl font-bold text-brand group-hover:text-[#06265a]">{item.course.title}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#66758d]">{item.course.description}</p>
      <div className="mt-4 text-sm font-semibold text-[#536179]">Giáo viên: {item.course.teacherName ?? "MindHub Coach"}</div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-sm font-semibold text-[#536179]">
          <span>{item.completedLessons}/{item.totalLessons} bài học</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>
    </Link>
  );
}

export function LessonList({
  courseId,
  path,
  progress
}: {
  courseId: number;
  path: PathItem[];
  progress: LessonProgress[];
}) {
  const progressByLesson = new Map(progress.map((item) => [item.lessonId, item]));

  if (path.length === 0) {
    return <EmptyState title="Chưa có bài học" description="Coach sẽ sớm gán lộ trình học cho khóa này." />;
  }

  return (
    <div className="space-y-3">
      {path.map((item, index) => {
        const done = progressByLesson.get(item.lessonId)?.completed;
        return (
          <Link
            className="flex items-center justify-between gap-4 rounded-3xl border border-[#d8e5f6] bg-white p-4 transition hover:border-brandOrange"
            href={`/student/courses/${courseId}/lessons/${item.lessonId}`}
            key={item.id}
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className={cn("grid h-11 w-11 place-items-center rounded-2xl text-sm font-bold", done ? "bg-brand text-white" : "bg-[#eaf2ff] text-brand")}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-brand">{item.lesson.title}</p>
                <p className="mt-1 text-sm text-[#66758d]">{item.lesson.questions.length} câu hỏi luyện tập</p>
              </div>
            </div>
            <span className={cn("shrink-0 rounded-2xl px-3 py-1 text-xs font-bold", done ? "bg-[#e9f9ef] text-green-700" : "bg-[#fff3e8] text-brandOrange")}>
              {done ? "Xem lại" : "Học tiếp"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function AssignmentCard({ assignment, onAction }: { assignment: Assignment; onAction?: () => void }) {
  const label = assignmentStatusLabel(assignment.studentStatus, assignment.overdue);
  const action = assignment.studentStatus === "graded" ? "Xem kết quả" : assignment.studentStatus === "submitted" ? "Đã nộp" : "Làm bài";

  return (
    <div className="rounded-3xl border border-[#d8e5f6] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-2xl bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-brand">
            {assignment.course?.subject.name ?? assignment.subject?.name ?? "MindHub"}
          </span>
          <h3 className="mt-3 text-lg font-bold text-brand">{assignment.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#66758d]">{assignment.description}</p>
        </div>
        <span className="rounded-2xl bg-[#fff3e8] px-3 py-1 text-xs font-bold text-brandOrange">{label}</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-[#536179] sm:grid-cols-3">
        <span>Khóa: {assignment.course?.title ?? "Chung"}</span>
        <span>Hạn: {formatDateTime(assignment.deadline)}</span>
        <span>Điểm: {assignment.submission?.score ?? "-"} / {assignment.maxScore ?? 10}</span>
      </div>
      {onAction ? (
        <button
          className="mt-5 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-[#06265a] disabled:opacity-60"
          disabled={assignment.studentStatus === "submitted"}
          onClick={onAction}
          type="button"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#cbd9ec] bg-[#f8fbff] p-8 text-center">
      <h3 className="text-lg font-bold text-brand">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#66758d]">{description}</p>
    </div>
  );
}

export function LoadingState({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  return (
    <div className={cn("grid place-items-center", fullScreen ? "min-h-screen bg-[#eef5ff]" : "min-h-72")}>
      <div className="rounded-3xl border border-[#d8e5f6] bg-white px-6 py-5 text-sm font-bold text-brand shadow-sm">
        {label}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPage
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        className="rounded-2xl border border-[#d8e5f6] bg-white px-4 py-2 text-sm font-bold text-brand disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        type="button"
      >
        Trước
      </button>
      <span className="px-3 text-sm font-bold text-[#66758d]">
        {page}/{totalPages}
      </span>
      <button
        className="rounded-2xl border border-[#d8e5f6] bg-white px-4 py-2 text-sm font-bold text-brand disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        type="button"
      >
        Sau
      </button>
    </div>
  );
}
