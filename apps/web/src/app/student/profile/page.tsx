"use client";

import { FormEvent, useEffect, useState } from "react";

import { getProfile, updateProfile } from "@/features/student/api";
import { Avatar, EmptyState, LoadingState, SectionCard } from "@/features/student/components";
import type { StudentProfile } from "@/features/student/types";
import type { AuthUser } from "@/lib/api-client";

export default function StudentProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Partial<StudentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((data) => {
        setUser(data.user);
        setProfile(data.profile);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được hồ sơ."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.grade?.trim()) {
      setMessage("Lớp/khối học là thông tin bắt buộc.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const data = await updateProfile(profile);
      setProfile(data.profile);
      setMessage("Đã lưu hồ sơ học sinh.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof StudentProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  if (loading) {
    return <LoadingState label="Đang mở hồ sơ học sinh..." />;
  }

  if (!user) {
    return <EmptyState title="Không tải được hồ sơ" description={message ?? "Vui lòng đăng nhập lại."} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <SectionCard>
        <div className="text-center">
          <div className="mx-auto w-fit">
            <Avatar name={user.fullName} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-brand">{user.fullName}</h2>
          <p className="mt-1 text-sm text-[#66758d]">{user.email}</p>
        </div>
        <div className="mt-6 space-y-3 rounded-3xl bg-[#f5f9ff] p-4 text-sm">
          <Info label="Lớp/khối" value={profile.grade} />
          <Info label="Trường" value={profile.schoolName} />
          <Info label="Mục tiêu điểm" value={profile.targetScore} />
          <Info label="Môn đang theo học" value={profile.preferredSubjects} />
        </div>
      </SectionCard>

      <SectionCard title="Cập nhật hồ sơ học tập">
        {message ? (
          <p className="mb-5 rounded-2xl border border-[#d8e5f6] bg-[#f8fbff] px-4 py-3 text-sm font-bold text-brand">
            {message}
          </p>
        ) : null}
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Lớp/khối học" onChange={(value) => updateField("grade", value)} required value={profile.grade ?? ""} />
            <Field label="Trường học" onChange={(value) => updateField("schoolName", value)} value={profile.schoolName ?? ""} />
            <Field label="Mục tiêu điểm số" onChange={(value) => updateField("targetScore", value)} value={profile.targetScore ?? ""} />
            <Field label="Số điện thoại phụ huynh" onChange={(value) => updateField("parentPhone", value)} value={profile.parentPhone ?? ""} />
          </div>
          <Field label="Môn đang theo học" onChange={(value) => updateField("preferredSubjects", value)} value={profile.preferredSubjects ?? ""} />
          <label className="block">
            <span className="text-sm font-bold text-brand">Mục tiêu học tập</span>
            <textarea
              className="mt-2 min-h-36 w-full rounded-2xl border border-[#d8e5f6] p-4 text-sm leading-6 outline-none focus:border-brandOrange focus:ring-4 focus:ring-brandOrange/15"
              onChange={(event) => updateField("learningGoals", event.target.value)}
              value={profile.learningGoals ?? ""}
            />
          </label>
          <button className="w-fit rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-[#06265a]" disabled={saving} type="submit">
            {saving ? "Đang lưu..." : "Lưu hồ sơ"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-semibold text-[#66758d]">{label}</span>
      <span className="text-right font-bold text-brand">{value || "Chưa cập nhật"}</span>
    </div>
  );
}

function Field({
  label,
  onChange,
  required,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-brand">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-2xl border border-[#d8e5f6] px-4 text-sm outline-none focus:border-brandOrange focus:ring-4 focus:ring-brandOrange/15"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}
