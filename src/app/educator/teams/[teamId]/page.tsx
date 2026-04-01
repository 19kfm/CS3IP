"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import {
  getTeamDetailsForEducator,
  listTeamTasks,
  setTaskStatus,
  assignTask,
  listTeamWorkLogs,
  getTeamFeedbackForEducator,
  getEducatorStudentContributionSummary,
  type EducatorFeedbackStudentView,
  type EducatorStudentContributionSummary,
  type WorkLogRow,
  type TaskRow,
  type TaskStatus,
} from "@/lib/db";

type TeamDetails = {
  team_id: string;
  team_name: string;
  course: { id: string; name: string; code: string; term: string };
  members: { id: string; email: string | null; display_name: string | null }[];
};

function statusBtnClass(active: boolean) {
  return active
    ? "rounded-xl bg-gray-900 px-3 py-2 text-sm text-white"
    : "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50";
}

function formatTaskStatus(status: TaskStatus) {
  if (status === "todo") return "To do";
  if (status === "doing") return "Doing";
  return "Done";
}

function formatScore(value: number | null) {
  return value == null ? "—" : value.toFixed(1);
}

function formatMinutes(m: number) {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  if (!r) return `${h}h`;
  return `${h}h ${r}m`;
}

export default function EducatorTeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId as string;

  const { loading, profile } = useRoleGuard("educator");

  const [details, setDetails] = useState<TeamDetails | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [logs, setLogs] = useState<WorkLogRow[]>([]);
  const [feedbackByStudent, setFeedbackByStudent] = useState<EducatorFeedbackStudentView[]>([]);
  const [contributionByStudent, setContributionByStudent] = useState<
    EducatorStudentContributionSummary[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const members = details?.members ?? [];

  useEffect(() => {
    if (loading) return;
    if (!teamId) return;

    setBusy(true);
    setError("");

    Promise.all([
      getTeamDetailsForEducator(teamId),
      listTeamTasks(teamId),
      listTeamWorkLogs(teamId),
      getTeamFeedbackForEducator(teamId),
      getEducatorStudentContributionSummary(teamId),
    ])
      .then(([d, t, l, f, c]) => {
        setDetails(d as TeamDetails);
        setTasks(t);
        setLogs(l);
        setFeedbackByStudent(f);
        setContributionByStudent(c);
      })
      .catch((e: any) => setError(e?.message ?? "Failed to load team"))
      .finally(() => setBusy(false));
  }, [loading, teamId]);

  async function logout() {
    await signOut();
    router.push("/login");
  }

  async function refreshTasks() {
    const t = await listTeamTasks(teamId);
    setTasks(t);
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    setError("");

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    try {
      setBusy(true);
      await setTaskStatus(taskId, status);
      await refreshTasks();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update task");
      await refreshTasks();
    } finally {
      setBusy(false);
    }
  }

  async function updateAssignee(taskId: string, assignedTo: string | null) {
    setError("");

    const selectedMember = members.find((m) => m.id === assignedTo) ?? null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              assigned_to: assignedTo,
              assigned_profile: selectedMember
                ? {
                    id: selectedMember.id,
                    email: selectedMember.email,
                    display_name: selectedMember.display_name,
                  }
                : null,
            }
          : t
      )
    );

    try {
      setBusy(true);
      await assignTask(taskId, assignedTo);
      await refreshTasks();
    } catch (e: any) {
      setError(e?.message ?? "Failed to assign task");
      await refreshTasks();
    } finally {
      setBusy(false);
    }
  }

  const todoCount = useMemo(() => tasks.filter((t) => t.status === "todo").length, [tasks]);
  const doingCount = useMemo(() => tasks.filter((t) => t.status === "doing").length, [tasks]);
  const doneCount = useMemo(() => tasks.filter((t) => t.status === "done").length, [tasks]);

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

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/educator/teams")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            Back
          </button>
          <span className="text-sm text-gray-500">{busy ? "Loading…" : ""}</span>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {!details ? (
            <p className="text-sm text-gray-600">Loading team…</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                {details.course.code} • {details.course.term}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-gray-900">{details.team_name}</h1>
              <p className="mt-1 text-sm text-gray-600">
                Course: <span className="font-medium">{details.course.name}</span>
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MiniStat label="Members" value={String(details.members.length)} />
                <MiniStat label="To do" value={String(todoCount)} />
                <MiniStat label="Doing" value={String(doingCount)} />
                <MiniStat label="Done" value={String(doneCount)} />
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Team roster</h2>
          {members.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No members assigned yet.</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {members.map((m) => (
                <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="font-medium text-gray-900">{m.display_name ?? "Student"}</p>
                  <p className="text-sm text-gray-600">{m.email ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Contribution tracking overview</h2>
            <span className="text-sm text-gray-500">{contributionByStudent.length} students</span>
          </div>

          {contributionByStudent.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              No contribution data yet.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {contributionByStudent.map((item) => (
                <div key={item.student.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.student.display_name ?? item.student.email ?? "Student"}
                      </p>
                      <p className="text-sm text-gray-500">{item.student.email ?? "—"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniStat label="Assigned tasks" value={String(item.task_counts.total)} />
                      <MiniStat label="Tasks done" value={String(item.task_counts.done)} />
                      <MiniStat
                        label="Work logged"
                        value={formatMinutes(item.worklog_summary.total_minutes)}
                      />
                      <MiniStat
                        label="Feedback avg"
                        value={formatScore(item.feedback_summary.avg_overall)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Task breakdown</p>
                      <div className="mt-2 space-y-1 text-sm text-gray-700">
                        <p>Total assigned: {item.task_counts.total}</p>
                        <p>To do: {item.task_counts.todo}</p>
                        <p>Doing: {item.task_counts.doing}</p>
                        <p>Done: {item.task_counts.done}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Concern tags</p>
                      {item.feedback_summary.top_tags.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.feedback_summary.top_tags.map((tag) => (
                            <span
                              key={tag.tag}
                              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
                            >
                              {tag.tag} ({tag.n})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No repeated concern tags.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Flags</p>
                      {item.flags.length ? (
                        <div className="mt-2 space-y-2">
                          {item.flags.map((flag) => (
                            <div
                              key={flag}
                              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                            >
                              {flag}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No current flags.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Recent assigned tasks</p>
                      {item.recent_tasks.length ? (
                        <div className="mt-2 space-y-2">
                          {item.recent_tasks.map((task) => (
                            <div key={task.id} className="rounded-lg bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                <span className="text-xs text-gray-500">
                                  {formatTaskStatus(task.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(task.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No assigned tasks yet.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Recent work logs</p>
                      {item.recent_logs.length ? (
                        <div className="mt-2 space-y-2">
                          {item.recent_logs.map((log) => (
                            <div key={log.id} className="rounded-lg bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900">{log.title}</p>
                                <span className="text-xs text-gray-500">
                                  {formatMinutes(log.minutes)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No work logs yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Team tasks</h2>
            <span className="text-sm text-gray-500">{tasks.length} total</span>
          </div>

          {tasks.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              No tasks yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{t.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Status: <span className="font-medium">{formatTaskStatus(t.status)}</span>
                        {t.assigned_profile ? (
                          <>
                            {" "}
                            • Assigned to:{" "}
                            <span className="font-medium">
                              {t.assigned_profile.display_name ?? t.assigned_profile.email ?? "Member"}
                            </span>
                          </>
                        ) : (
                          <> • Unassigned</>
                        )}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(t.id, "todo")}
                          className={statusBtnClass(t.status === "todo")}
                        >
                          To do
                        </button>

                        <button
                          type="button"
                          onClick={() => updateStatus(t.id, "doing")}
                          className={statusBtnClass(t.status === "doing")}
                        >
                          Doing
                        </button>

                        <button
                          type="button"
                          onClick={() => updateStatus(t.id, "done")}
                          className={statusBtnClass(t.status === "done")}
                        >
                          Done
                        </button>
                      </div>
                    </div>

                    <div className="sm:w-[260px]">
                      <label className="text-xs font-medium text-gray-700">Reassign</label>
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                        value={t.assigned_to ?? ""}
                        onChange={(e) => updateAssignee(t.id, e.target.value || null)}
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.display_name ?? m.email ?? "Member"}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => updateAssignee(t.id, null)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Clear assignment
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Work logs</h2>
            <span className="text-sm text-gray-500">{logs.length} entries</span>
          </div>

          {logs.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              No work logs yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {logs.map((l) => (
                <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{l.title}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {l.description ? l.description : <span className="text-gray-400">No description.</span>}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>By: {l.profiles?.display_name ?? l.profiles?.email ?? "Student"}</span>
                        <span>•</span>
                        <span>{new Date(l.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>{formatMinutes(l.minutes)}</span>
                      </div>
                    </div>

                    {l.link ? (
                      <a
                        href={l.link}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                      >
                        Open link
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Peer feedback overview</h2>
            <span className="text-sm text-gray-500">{feedbackByStudent.length} students</span>
          </div>

          {feedbackByStudent.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              No feedback data yet.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {feedbackByStudent.map((item) => (
                <div key={item.student.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.student.display_name ?? item.student.email ?? "Student"}
                      </p>
                      <p className="text-sm text-gray-500">{item.student.email ?? "—"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniStat label="Entries" value={String(item.summary.count)} />
                      <MiniStat label="Reliability" value={formatScore(item.summary.avg_reliability)} />
                      <MiniStat label="Communication" value={formatScore(item.summary.avg_communication)} />
                      <MiniStat label="Work quality" value={formatScore(item.summary.avg_work_quality)} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Common concern tags</p>
                      {item.summary.top_tags.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.summary.top_tags.map((tag) => (
                            <span
                              key={tag.tag}
                              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
                            >
                              {tag.tag} ({tag.n})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No concern tags.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Visible comments</p>
                      {item.comments.length ? (
                        <div className="mt-2 space-y-2">
                          {item.comments.map((comment) => (
                            <div
                              key={`${comment.created_at}-${comment.text}`}
                              className="rounded-lg bg-white p-3 text-sm text-gray-700"
                            >
                              <p>{comment.text}</p>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No visible comments.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">Educator-only notes</p>
                      {item.private_notes.length ? (
                        <div className="mt-2 space-y-2">
                          {item.private_notes.map((note) => (
                            <div
                              key={`${note.created_at}-${note.text}`}
                              className="rounded-lg bg-white p-3 text-sm text-gray-700"
                            >
                              <p>{note.text}</p>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(note.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No educator-only notes.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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