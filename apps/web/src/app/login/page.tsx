"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiRequest, getStoredUser, storeSession, type AuthUser } from "@/lib/api-client";
import { dashboardFor } from "@/lib/navigation";

interface LoginResponse {
  token: string;
  user: AuthUser;
}

const subjectChips = ["Toán", "Lý", "Hóa", "THCS", "THPT"];

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({ username: "", password: "" });

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      router.replace(dashboardFor(user.role));
    }
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify(credentials)
      });
      storeSession(response.token, response.user);
      router.push(dashboardFor(response.user.role));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Đăng nhập không thành công.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,#eef5ff_0,#f7faff_42%,#edf4ff_100%)] text-ink">
      <div className="mx-auto grid min-h-dvh w-full max-w-[1440px] items-center gap-7 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.72fr)] lg:px-8 xl:gap-10">
        <section className="relative overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_24px_70px_rgba(8,47,111,0.12)]">
          <img
            alt="MindHub learning banner"
            className="h-[260px] w-full object-contain object-center p-2 sm:h-[360px] lg:h-[min(74dvh,660px)] lg:p-0"
            src="/brand/mindhub-cover.png"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent px-5 pb-5 pt-20 sm:px-8 sm:pb-7 lg:hidden">
            <p className="text-sm font-semibold uppercase tracking-wide text-brandOrange">
              MindHub LMS
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-brand">
              Người bạn đồng hành trên hành trình tư duy.
            </h1>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[520px]">
          <div className="mb-5 hidden lg:block">
            <p className="text-sm font-semibold uppercase tracking-wide text-brandOrange">
              MindHub LMS
            </p>
            <h1 className="mt-2 text-[2.45rem] font-bold leading-[1.12] text-brand xl:text-[2.85rem]">
              Người bạn đồng hành trên hành trình tư duy.
            </h1>
            <p className="mt-3 text-base leading-7 text-[#516078]">
              Quản lý lộ trình học tập cá nhân hóa, tài liệu và tiến độ của học sinh trong một
              không gian rõ ràng, hiện đại.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {subjectChips.map((chip) => (
                <span
                  className="rounded-full border border-[#d7e1f0] bg-white px-4 py-2 text-sm font-bold text-brand shadow-sm"
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_20px_56px_rgba(8,47,111,0.13)] sm:p-7 xl:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 h-1.5 w-20 rounded-full bg-brandOrange" />
                <h2 className="text-3xl font-bold text-brand">Đăng nhập</h2>
                <p className="mt-2 text-sm leading-6 text-[#516078]">
                  Truy cập không gian học tập cá nhân hóa của MindHub.
                </p>
              </div>
              <img
                alt=""
                className="hidden h-14 w-14 rounded-2xl object-contain mix-blend-multiply sm:block"
                src="/brand/mindhub-logo.png"
              />
            </div>

            {message ? (
              <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {message}
              </p>
            ) : null}

            <form className="space-y-4" onSubmit={handleLogin}>
              <Field
                label="Tên đăng nhập"
                name="username"
                onChange={(value) => setCredentials((current) => ({ ...current, username: value }))}
                value={credentials.username}
              />
              <Field
                label="Mật khẩu"
                name="password"
                onChange={(value) => setCredentials((current) => ({ ...current, password: value }))}
                type="password"
                value={credentials.password}
              />
              <button
                className="h-12 w-full rounded-2xl bg-brand px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(8,47,111,0.2)] transition hover:-translate-y-0.5 hover:bg-[#06265a] focus:outline-none focus:ring-4 focus:ring-brandOrange/25 disabled:translate-y-0 disabled:opacity-70"
                disabled={loading}
                type="submit"
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>

            <p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-[#516078]">
              Tài khoản được cấp bởi trung tâm MindHub. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  onChange,
  type = "text",
  value
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-2xl border border-[#d4deed] bg-[#f7faff] px-4 text-sm outline-none transition placeholder:text-[#8a96aa] focus:border-brandOrange focus:bg-white focus:ring-4 focus:ring-brandOrange/15"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
