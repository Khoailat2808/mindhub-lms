"use client";

import { FormEvent, useEffect, useState } from "react";

import { getAssignments, startAssignment, submitAssignment } from "@/features/student/api";
import { AssignmentCard, EmptyState, LoadingState, Pagination, SectionCard } from "@/features/student/components";
import type { Assignment, PaginatedResponse } from "@/features/student/types";

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "not_started", label: "Chưa làm" },
  { value: "in_progress", label: "Đang làm" },
  { value: "submitted", label: "Đã nộp" },
  { value: "graded", label: "Đã chấm" }
];

export default function StudentAssignmentsPage() {
  const [data, setData] = useState<PaginatedResponse<Assignment> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getAssignments({ page, pageSize: 6, status, search })
      .then(setData)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được bài tập."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, search, status]);

  async function handleOpen(assignment: Assignment) {
    setActiveAssignment(assignment);
    setAnswerText(assignment.submission?.answerText ?? "");
    if (assignment.studentStatus === "not_started") {
      await startAssignment(assignment.id);
      load();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAssignment) {
      return;
    }
    await submitAssignment(activeAssignment.id, answerText);
    setActiveAssignment(null);
    setAnswerText("");
    load();
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <input
            className="h-12 rounded-2xl border border-[#d8e5f6] px-4 text-sm outline-none focus:border-brandOrange focus:ring-4 focus:ring-brandOrange/15"
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Tìm bài tập, bài kiểm tra..."
            value={search}
          />
          <select
            className="h-12 rounded-2xl border border-[#d8e5f6] bg-white px-4 text-sm font-semibold text-brand outline-none"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            value={status}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      {loading ? (
        <LoadingState label="Đang tải bài tập..." />
      ) : message ? (
        <EmptyState title="Không tải được bài tập" description={message} />
      ) : data && data.items.length > 0 ? (
        <div className="space-y-4">
          {data.items.map((assignment) => (
            <AssignmentCard assignment={assignment} key={assignment.id} onAction={() => handleOpen(assignment)} />
          ))}
          <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      ) : (
        <EmptyState title="Chưa có bài tập" description="Khi coach giao nhiệm vụ mới, bạn sẽ thấy ở đây." />
      )}

      {activeAssignment ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand/35 px-4 backdrop-blur-sm">
          <form className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-[0_30px_90px_rgba(8,47,111,0.25)]" onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold text-brand">{activeAssignment.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#66758d]">{activeAssignment.description}</p>
            <textarea
              className="mt-5 min-h-56 w-full rounded-3xl border border-[#d8e5f6] p-4 text-sm leading-6 outline-none focus:border-brandOrange focus:ring-4 focus:ring-brandOrange/15"
              onChange={(event) => setAnswerText(event.target.value)}
              placeholder="Nhập bài làm hoặc ghi chú câu trả lời của bạn..."
              required
              value={answerText}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className="rounded-2xl border border-[#d8e5f6] px-5 py-3 text-sm font-bold text-brand" onClick={() => setActiveAssignment(null)} type="button">
                Đóng
              </button>
              <button className="rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-[#06265a]" type="submit">
                Nộp bài
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
