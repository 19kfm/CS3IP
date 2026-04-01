"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  listMyCourses,
  getEducatorDashboardSummary,
  type EducatorDashboardCourseSummary,
} from "@/lib/db";

type Course = {
  id: string;
  name: string;
  code: string;
  term: string;
};

function formatScore(value: number | null) {
  return value == null ? "—" : value.toFixed(1);
}

function formatMinutes(m: number) {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  if (!r) return `${h}h`;
  return `${h}h ${r}m`;
}

export default function EducatorDashboard() {
  const router = useRouter();
  const { loading, profile } = useRoleGuard("educator");

  const [courses, setCourses] = useState<Course[]>([]);
  const [dashboardData, setDashboardData] = useState<EducatorDashboardCourseSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading) {
      setBusy(true);
      Promise.all([listMyCourses(), getEducatorDashboardSummary()])
        .then(([c, summary]) => {
          setCourses(c as Course[]);
          setDashboardData(summary);
        })
        .catch((e: any) => setError(e?.message ?? "Failed to load dashboard"))
        .finally(() => setBusy(false));
    }
  }, [loading]);

  async function logout() {
    await signOut();
    router.push("/login");
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <main className="min-h-screen bg-gray-50">
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

            <Link href="/educator/dashboard" className="font-medium text-gray-900">
              My Courses
            </Link>

            <Link href="/educator/teams" className="text-gray-600 hover:text-gray-900">
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

        <div className="md:hidden border-t bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-3 px-6 py-3 text-sm">
            <Link href="/educator/health" className="text-gray-600 hover:text-gray-900">
              Team Health
            </Link>
            <Link href="/educator/dashboard" className="font-medium text-gray-900">
              My Courses
            </Link>
            <Link href="/educator/teams" className="text-gray-600 hover:text-gray-900">
              Team View
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">My Courses</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{busy ? "Loading…" : ""}</span>
            <Link
              href="/educator/course/new"
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Create Course
            </Link>
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {courses.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600">
            No courses yet. Click “Create Course” to add your first course.
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((c) => {
              const courseSummary = dashboardData.find((d) => d.course.id === c.id);

              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm text-gray-500">
                        {c.code} • {c.term}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{c.name}</p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/educator/course/${c.id}/teams`}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Teams
                      </Link>

                      <Link
                        href={`/educator/teams?course=${c.id}`}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Team View
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <MiniStat
                      label="Teams"
                      value={String(courseSummary?.totals.teams ?? 0)}
                    />
                    <MiniStat
                      label="Students"
                      value={String(courseSummary?.totals.students ?? 0)}
                    />
                    <MiniStat
                      label="Tasks"
                      value={String(courseSummary?.totals.tasks ?? 0)}
                    />
                    <MiniStat
                      label="Done tasks"
                      value={String(courseSummary?.totals.done_tasks ?? 0)}
                    />
                    <MiniStat
                      label="Work logged"
                      value={formatMinutes(courseSummary?.totals.worklog_minutes ?? 0)}
                    />
                    <MiniStat
                      label="At-risk teams"
                      value={String(courseSummary?.totals.at_risk_teams ?? 0)}
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Course overview</h3>
                      <span className="text-xs text-gray-500">
                        Feedback entries: {courseSummary?.totals.feedback_entries ?? 0}
                      </span>
                    </div>

                    {!courseSummary || courseSummary.teams.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">
                        No team summary data yet for this course.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {courseSummary.teams.map((team) => (
                          <div
                            key={team.team_id}
                            className="rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">{team.team_name}</p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      team.risk === "At risk"
                                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                                        : "border border-green-200 bg-green-50 text-green-800"
                                    }`}
                                  >
                                    {team.risk}
                                  </span>
                                </div>

                                <p className="mt-1 text-sm text-gray-500">
                                  {team.member_count} members
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <MiniStat label="Tasks" value={String(team.task_counts.total)} />
                                <MiniStat label="Done" value={String(team.task_counts.done)} />
                                <MiniStat
                                  label="Work logged"
                                  value={formatMinutes(team.worklog_summary.total_minutes)}
                                />
                                <MiniStat
                                  label="Feedback avg"
                                  value={formatScore(team.feedback_summary.avg_overall)}
                                />
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <p className="text-sm font-medium text-gray-900">Task breakdown</p>
                                <div className="mt-2 space-y-1 text-sm text-gray-700">
                                  <p>Total: {team.task_counts.total}</p>
                                  <p>To do: {team.task_counts.todo}</p>
                                  <p>Doing: {team.task_counts.doing}</p>
                                  <p>Done: {team.task_counts.done}</p>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <p className="text-sm font-medium text-gray-900">Concern tags</p>
                                {team.feedback_summary.top_tags.length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {team.feedback_summary.top_tags.map((tag) => (
                                      <span
                                        key={tag.tag}
                                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
                                      >
                                        {tag.tag} ({tag.n})
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">
                                    No repeated concern tags.
                                  </p>
                                )}
                              </div>

                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <p className="text-sm font-medium text-gray-900">Risk reasons</p>
                                {team.risk_reasons.length ? (
                                  <div className="mt-2 space-y-2">
                                    {team.risk_reasons.map((reason) => (
                                      <div
                                        key={reason}
                                        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                                      >
                                        {reason}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">
                                    No current risk reasons.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 flex justify-end">
                              <Link
                                href={`/educator/teams/${team.team_id}`}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                              >
                                Open team detail
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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