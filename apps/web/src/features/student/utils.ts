export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function percent(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Chưa có lịch";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function assignmentStatusLabel(status: string, overdue?: boolean) {
  if (status === "graded") {
    return "Đã chấm";
  }

  if (status === "submitted") {
    return "Đã nộp";
  }

  if (status === "in_progress") {
    return "Đang làm";
  }

  return overdue ? "Quá hạn" : "Chưa làm";
}

export function lessonStatusLabel(completed?: boolean, active?: boolean) {
  if (!active) {
    return "Đang học";
  }

  return completed ? "Hoàn thành" : "Chưa học";
}
