"use client";

import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/common/AppShell";
import { apiRequest, type AuthUser } from "@/lib/api-client";

interface AdminOverview {
  counts: {
    users: Record<string, number>;
    subjects: number;
    courses: number;
    lessons: number;
    assignments: number;
    submissions: number;
  };
}

interface UserRow extends AuthUser {
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

const roles: AuthUser["role"][] = ["student", "teacher", "admin"];

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<Paginated<UserRow> | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({ pageSize: "20" });
      if (roleFilter) {
        query.set("role", roleFilter);
      }
      if (search) {
        query.set("search", search);
      }
      const [overviewData, userData] = await Promise.all([
        apiRequest<AdminOverview>("/admin/overview"),
        apiRequest<Paginated<UserRow>>(`/admin/users?${query.toString()}`)
      ]);
      setOverview(overviewData);
      setUsers(userData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được khu vực quản trị.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [roleFilter, search]);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = form.get("role") as AuthUser["role"];
    const endpoint = role === "teacher" ? "/auth/teachers" : "/auth/students";

    try {
      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
          fullName: form.get("fullName")
        })
      });
      event.currentTarget.reset();
      setMessage("Đã tạo tài khoản mới.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được tài khoản.");
    }
  }

  async function handleRoleChange(user: UserRow, role: AuthUser["role"]) {
    await apiRequest(`/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role })
    });
    await load();
  }

  async function handleDeleteUser(user: UserRow) {
    if (!window.confirm(`Xóa tài khoản ${user.fullName}? Tài khoản có lịch sử học tập sẽ không thể xóa.`)) {
      return;
    }

    try {
      await apiRequest(`/admin/users/${user.id}`, { method: "DELETE" });
      setMessage("Đã xóa tài khoản.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xóa được tài khoản.");
    }
  }

  return (
    <AppShell allowedRoles={["admin"]}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Quản trị MindHub</h1>
          <p className="mt-2 text-sm text-muted">Theo dõi dữ liệu hệ thống, tài khoản và quyền truy cập.</p>
        </div>
        <button className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium" onClick={load} type="button">
          Làm mới
        </button>
      </div>

      {message ? <Notice>{message}</Notice> : null}

      {loading && !overview ? (
        <Notice>Đang tải dữ liệu quản trị...</Notice>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Admin" value={overview?.counts.users.admin ?? 0} />
            <Stat label="Teacher" value={(overview?.counts.users.teacher ?? 0) + (overview?.counts.users.coach ?? 0)} />
            <Stat label="Student" value={overview?.counts.users.student ?? 0} />
            <Stat label="Khóa học" value={overview?.counts.courses ?? 0} />
            <Stat label="Bài học" value={overview?.counts.lessons ?? 0} />
            <Stat label="Bài tập" value={overview?.counts.assignments ?? 0} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Panel title="Tạo tài khoản">
              <form className="grid gap-4" onSubmit={handleCreateAccount}>
                <Field label="Họ tên" name="fullName" />
                <Field label="Username" name="username" />
                <Field label="Email" name="email" type="email" />
                <Field label="Mật khẩu tạm" name="password" type="password" />
                <label className="block">
                  <span className="text-sm font-medium text-ink">Role</span>
                  <select className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm" name="role" defaultValue="student">
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </label>
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">
                  Tạo tài khoản
                </button>
              </form>
            </Panel>

            <Panel title="Tài khoản hệ thống">
              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
                <input
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên, email, username"
                  value={search}
                />
                <select className="rounded-md border border-line px-3 py-2 text-sm" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
                  <option value="">Tất cả role</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">Người dùng</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">Email</th>
                      <th className="py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {users?.items.map((user) => (
                      <tr key={user.id}>
                        <td className="py-3">
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-xs text-muted">@{user.username}</p>
                        </td>
                        <td className="py-3">
                          <select className="rounded-md border border-line px-2 py-1 text-xs" onChange={(event) => handleRoleChange(user, event.target.value as AuthUser["role"])} value={user.role}>
                            {roles.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-muted">{user.email}</td>
                        <td className="py-3 text-right">
                          <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600" onClick={() => handleDeleteUser(user)} type="button">
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-brand">{value}</p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 rounded-md border border-line bg-white px-4 py-3 text-sm text-muted">{children}</p>;
}

function Field({ label, name, type = "text" }: { label: string; name: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand" name={name} required type={type} />
    </label>
  );
}
