"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { listMyCourses, getCourseTeamHealth } from "@/lib/db";

type Course = { id: string; name: string; code: string; term: string };

type TeamHealthRow = {
  team_id: string;
  team_name: string;
  feedback_count: number;
  avg_reliability: number | null;
  avg_communication: number | null;
  avg_work_quality: number | null;
  top_tags: { tag: string; n: number }[];
  risk: "At risk" | "OK";
};

function fmt(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

export default function EducatorHealthPage() {
  const router = useRouter();
  const { loading, profile } = useRoleGuard("educator");

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState<TeamHealthRow[]>([]);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading) {
      listMyCourses()
        .then((c: any[]) => {
          setCourses(c as Course[]);
          if (c?.[0]?.id) setCourseId(c[0].id);
        })
        .catch((e) => setError(e.message ?? "Failed to load courses"));
    }
  }, [loading]);

  useEffect(() => {
    if (!courseId) return;
    setBusy(true);
    setError("");

    getCourseTeamHealth(courseId)
      .then((r: any) => setRows(r as TeamHealthRow[]))
      .catch((e) => setError(e.message ?? "Failed to load team health"))
      .finally(() => setBusy(false));
  }, [courseId]);

  if (loading) return <div className="p-6">Loading...</div>;

  async function logout() {
    await signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ✅ Same header/nav style as educator dashboard */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white text-sm font-bold">
              T
            </div>
            <span className="text-sm font-semibold text-gray-900">TeamUp</span>
          </div>

          {/* Center: Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/educator/health" className="font-medium text-gray-900">
              Team Health
            </Link>
            <Link href="/educator/dashboard" className="text-gray-600 hover:text-gray-900">
              Educator Dashboard
            </Link>
            <span className="text-gray-400">Educator Team View</span>
          </nav>

          {/* Right: User + logout */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.display_name ?? "Educator"}
              </p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
            </div>

            <button
              onClick={logout}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3 text-sm">
            <Link href="/educator/health" className="font-medium text-gray-900">
              Team Health
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/educator/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">Course</label>
              <select
                className="mt-1 w-full sm:w-[360px] rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} • {c.term} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-gray-600">{busy ? "Loading…" : `Teams: ${rows.length}`}</div>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            This dashboard aggregates anonymous peer feedback into simple team-level indicators.
            (MVP: basic averages + concern tags.)
          </p>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.team_id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{r.feedback_count} feedback entries</p>
                  <h2 className="text-lg font-semibold text-gray-900">{r.team_name}</h2>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    r.risk === "At risk"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                  }`}
                >
                  {r.risk}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric label="Reliability" value={fmt(r.avg_reliability)} />
                <Metric label="Communication" value={fmt(r.avg_communication)} />
                <Metric label="Work quality" value={fmt(r.avg_work_quality)} />
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-gray-900">Top concern tags</p>
                {r.top_tags.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500">No tags selected yet.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.top_tags.map((t) => (
                      <span
                        key={t.tag}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                      >
                        {t.tag} ({t.n})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {!busy && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600">
              No teams found for this course yet.
            </div>
          )}
        </div>

        {/* Small helper */}
        <div className="text-sm text-gray-500">
          Tip: team indicators will appear once students submit feedback.
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}