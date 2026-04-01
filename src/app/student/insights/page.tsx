"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import {
  getMyContributionSummary,
  type StudentContributionSummary,
} from "@/lib/db";

function formatScore(value: number | null) {
  return value == null ? "—" : value.toFixed(1);
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function statusBadge(status: "todo" | "doing" | "done") {
  if (status === "todo") return "To do";
  if (status === "doing") return "Doing";
  return "Done";
}

export default function StudentInsightsPage() {
  const router = useRouter();
  const { loading, profile } = useRoleGuard("student");

  const [data, setData] = useState<StudentContributionSummary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;

    setBusy(true);
    setError("");

    getMyContributionSummary()
      .then(setData)
      .catch((e: any) => setError(e?.message ?? "Failed to load contribution summary"))
      .finally(() => setBusy(false));
  }, [loading]);

  async function logout() {
    await signOut();
    router.push("/login");
  }

  if (loading) return <div className="p-6">Loading...</div>;

  const summary = data;

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
            <Link href="/student/dashboard" className="text-gray-600 hover:text-gray-900">
              Student Dashboard
            </Link>
            <Link href="/student/workspace" className="text-gray-600 hover:text-gray-900">
              Team Workspace
            </Link>
            <Link href="/student/feedback" className="text-gray-600 hover:text-gray-900">
              Peer Feedback
            </Link>
            <Link href="/student/health" className="text-gray-600 hover:text-gray-900">
              Team Health
            </Link>
            <Link href="/student/insights" className="font-medium text-gray-900">
              Personal Insights
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.display_name ?? "Student"}
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
            <a href="/student/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </a>
            <a href="/student/workspace" className="text-gray-600 hover:text-gray-900">
              Workspace
            </a>
            <a href="/student/feedback" className="text-gray-600 hover:text-gray-900">
              Feedback
            </a>
            <a href="/student/health" className="text-gray-600 hover:text-gray-900">
              Health
            </a>
            <span className="font-medium text-gray-900">Insights</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {busy ? <p className="text-sm text-gray-500">Loading…</p> : null}
        {error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}

        {!summary?.team ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Personal Insights</h1>
            <p className="mt-2 text-sm text-gray-600">
              You are not currently assigned to a team, so there is no contribution summary yet.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                {summary.team.course_code} • {summary.team.term}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-gray-900">Personal Insights</h1>
              <p className="mt-1 text-sm text-gray-600">
                Team: <span className="font-medium">{summary.team.name}</span> • Course:{" "}
                <span className="font-medium">{summary.team.course_name}</span>
              </p>
              <p className="mt-3 text-sm text-gray-500">
                This summary combines your assigned tasks, work logs, and anonymous peer feedback.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MiniStat label="Assigned tasks" value={String(summary.task_counts.total)} />
                <MiniStat label="Tasks done" value={String(summary.task_counts.done)} />
                <MiniStat
                  label="Work logged"
                  value={formatMinutes(summary.worklog_summary.total_minutes)}
                />
                <MiniStat
                  label="Feedback average"
                  value={formatScore(summary.feedback_summary.avg_overall)}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">My assigned tasks</h2>

                <div className="mt-4 grid gap-3 grid-cols-4">
                  <MiniStat label="Total" value={String(summary.task_counts.total)} />
                  <MiniStat label="To do" value={String(summary.task_counts.todo)} />
                  <MiniStat label="Doing" value={String(summary.task_counts.doing)} />
                  <MiniStat label="Done" value={String(summary.task_counts.done)} />
                </div>

                {summary.recent_assigned_tasks.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No tasks are currently assigned to you.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {summary.recent_assigned_tasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-900">{task.title}</p>
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                            {statusBadge(task.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Created {new Date(task.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">My work log activity</h2>

                <div className="mt-4 grid gap-3 grid-cols-2">
                  <MiniStat label="Entries" value={String(summary.worklog_summary.count)} />
                  <MiniStat
                    label="Total time"
                    value={formatMinutes(summary.worklog_summary.total_minutes)}
                  />
                </div>

                {summary.worklog_summary.recent.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">You have not logged any work yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {summary.worklog_summary.recent.map((log) => (
                      <div key={log.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-900">{log.title}</p>
                          <span className="text-xs text-gray-500">
                            {formatMinutes(log.minutes ?? 0)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {log.description ? log.description : "No description."}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Peer feedback snapshot</h2>
                <span className="text-sm text-gray-500">
                  {summary.feedback_summary.count} entries
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MiniStat
                  label="Reliability"
                  value={formatScore(summary.feedback_summary.avg_reliability)}
                />
                <MiniStat
                  label="Communication"
                  value={formatScore(summary.feedback_summary.avg_communication)}
                />
                <MiniStat
                  label="Work quality"
                  value={formatScore(summary.feedback_summary.avg_work_quality)}
                />
                <MiniStat
                  label="Overall"
                  value={formatScore(summary.feedback_summary.avg_overall)}
                />
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900">Common concern tags</p>

                {summary.feedback_summary.top_tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summary.feedback_summary.top_tags.map((tag) => (
                      <span
                        key={tag.tag}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
                      >
                        {tag.tag} ({tag.n})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">No repeated concern tags yet.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Strengths</h2>
                {summary.strengths.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">
                    Not enough data yet to highlight strengths.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {summary.strengths.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Needs attention</h2>
                {summary.attention_areas.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">
                    No major attention areas are currently being flagged.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {summary.attention_areas.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
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