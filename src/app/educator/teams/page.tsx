"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import { listMyCourses, listTeams, getTeamMetaForCourse } from "@/lib/db";

type Course = { id: string; name: string; code: string; term: string };

type TeamMeta = {
  team_id: string;
  team_name: string;
  member_count: number;
  open_tasks: number;
  done_tasks: number;
};

export default function EducatorTeamsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const { loading, profile } = useRoleGuard("educator");

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>(sp.get("course") ?? "");
  const [teams, setTeams] = useState<{ id: string; name: string; course_id: string }[]>([]);
  const [meta, setMeta] = useState<Record<string, TeamMeta>>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId]
  );

  useEffect(() => {
    if (!loading) {
      setError("");
      listMyCourses()
        .then((c: any) => {
          const arr = c as Course[];
          setCourses(arr);

          // If URL didn’t provide a course, pick first
          if (!courseId && arr?.[0]?.id) setCourseId(arr[0].id);
        })
        .catch((e) => setError(e?.message ?? "Failed to load courses"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function loadTeams(cid: string) {
    setBusy(true);
    setError("");
    try {
      const t = (await listTeams(cid)) as any[];
      setTeams(t as any);

      // meta = member counts + tasks counts
      const m = (await getTeamMetaForCourse(cid)) as TeamMeta[];
      const map: Record<string, TeamMeta> = {};
      for (const row of m) map[row.team_id] = row;
      setMeta(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load teams");
      setTeams([]);
      setMeta({});
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!courseId) return;
    if (loading) return;
    loadTeams(courseId);
  }, [courseId, loading]);

  async function logout() {
    await signOut();
    router.push("/login");
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white text-sm font-bold">
              T
            </div>
            <span className="text-sm font-semibold text-gray-900">TeamUp</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/educator/health" className="text-gray-600 hover:text-gray-900">
              Team Health
            </Link>
            <Link href="/educator/dashboard" className="text-gray-600 hover:text-gray-900">
              My Courses
            </Link>
            <Link href="/educator/teams" className="font-medium text-gray-900">
              Educator Team View
            </Link>
          </nav>

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
      </header>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Educator Team View</h1>
              <p className="mt-1 text-sm text-gray-600">
                Browse teams and open the detailed team view (roster + tasks + logs).
              </p>
            </div>

            <div className="min-w-[280px]">
              <label className="text-xs font-medium text-gray-700">Course</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
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
          </div>

          <div className="mt-3 text-sm text-gray-600">
            {busy ? "Loading…" : selectedCourse ? `Teams for ${selectedCourse.code} (${teams.length})` : ""}
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((t) => {
            const m = meta[t.id];
            return (
              <Link
                key={t.id}
                href={`/educator/teams/${t.id}`}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{selectedCourse?.code} • {selectedCourse?.term}</p>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">{t.name}</h2>
                  </div>

                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                    View
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <MiniStat label="Members" value={m ? String(m.member_count) : "—"} />
                  <MiniStat label="Open" value={m ? String(m.open_tasks) : "—"} />
                  <MiniStat label="Done" value={m ? String(m.done_tasks) : "—"} />
                </div>
              </Link>
            );
          })}

          {!busy && teams.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600">
              No teams found for this course yet. Create teams from <span className="font-medium">My Courses → Teams</span>.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-900">{value}</p>
    </div>
  );
}