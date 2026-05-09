"use client";

import { useEffect, useMemo, useState } from "react";

import { getCourses } from "@/features/student/api";
import { CourseCard, EmptyState, LoadingState, SectionCard } from "@/features/student/components";
import type { CourseCardData } from "@/features/student/types";
import { percent } from "@/features/student/utils";

const subjects = ["Tất cả", "Toán", "Math", "Vật lý", "Hóa học"];
const statuses = ["Tất cả", "Đang học", "Hoàn thành", "Chưa bắt đầu"];

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [subject, setSubject] = useState("Tất cả");
  const [status, setStatus] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getCourses()
      .then((data) => setCourses(data.courses))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được khóa học."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return courses.filter((item) => {
      const progress = percent(item.completedLessons, item.totalLessons);
      const currentStatus = progress === 100 ? "Hoàn thành" : progress > 0 ? "Đang học" : "Chưa bắt đầu";
      const subjectMatches =
        subject === "Tất cả" || (item.course.subject?.name ?? "MindHub").toLowerCase().includes(subject.toLowerCase());
      const statusMatches = status === "Tất cả" || status === currentStatus;
      const text = `${item.course.title} ${item.course.description ?? ""} ${item.course.teacherName ?? ""}`.toLowerCase();
      return subjectMatches && statusMatches && text.includes(search.toLowerCase());
    });
  }, [courses, search, status, subject]);

  if (loading) {
    return <LoadingState label="Đang lấy danh sách khóa học..." />;
  }

  if (message) {
    return <EmptyState title="Không tải được khóa học" description={message} />;
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
          <input
            className="h-12 rounded-2xl border border-[#d8e5f6] px-4 text-sm outline-none transition focus:border-brandOrange focus:ring-4 focus:ring-brandOrange/15"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm khóa học..."
            value={search}
          />
          <Select onChange={setSubject} options={subjects} value={subject} />
          <Select onChange={setStatus} options={statuses} value={status} />
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState title="Không tìm thấy khóa học" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm nhé." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <CourseCard item={item} key={item.course.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  onChange,
  options,
  value
}: {
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <select
      className="h-12 rounded-2xl border border-[#d8e5f6] bg-white px-4 text-sm font-semibold text-brand outline-none focus:border-brandOrange"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
