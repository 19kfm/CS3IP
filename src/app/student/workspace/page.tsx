"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import {
  getTeamNote,
  upsertTeamNote,
  listTeamResources,
  createTeamResource,
  deleteTeamResource,
  type TeamResourceKind,
  type TeamResourceRow,
  createWorkLog,
  getMyTeamMembership,
  listTeamWorkLogs,
  type WorkLogRow,
  listTeamTasks,
  createTask,
  setTaskStatus,
  assignTask,
  type TaskRow,
  type TaskStatus,
  listMyTeamMembers,
} from "@/lib/db";

type Membership = {
  team_id: string;
  teams: {
    id: string;
    name: string;
    course_id: string;
    courses: { id: string; name: string; code: string; term: string };
  };
} | null;

type Member = { id: string; email: string | null; display_name: string | null };

function formatMinutes(m: number) {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  if (!r) return `${h}h`;
  return `${h}h ${r}m`;
}

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

export default function StudentWorkspacePage() {
  const router = useRouter();
  const { loading, profile } = useRoleGuard("student");

  const [membership, setMembership] = useState<Membership>(null);
  const [mLoading, setMLoading] = useState(true);

  // WORK LOGS
  const [logs, setLogs] = useState<WorkLogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // New log form
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState<number>(30);
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");

  // TASKS
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [assignTo, setAssignTo] = useState<string>("");
  const [tBusy, setTBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  // SHARED WORKSPACE
  const [teamNote, setTeamNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [resources, setResources] = useState<TeamResourceRow[]>([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceKind, setResourceKind] = useState<TeamResourceKind>("link");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceBusy, setResourceBusy] = useState(false);

  const assigned = !!membership?.teams;
  const teamId = membership?.team_id ?? "";

  useEffect(() => {
    if (!loading) {
      setMLoading(true);
      getMyTeamMembership()
        .then((m) => setMembership(m as Membership))
        .catch((e: any) => setError(e?.message ?? "Failed to load membership"))
        .finally(() => setMLoading(false));
    }
  }, [loading]);

  async function refreshLogs(tid: string) {
    const rows = await listTeamWorkLogs(tid);
    setLogs(rows);
  }

  async function refreshTasks(tid: string) {
    const rows = await listTeamTasks(tid);
    setTasks(rows);
  }

  async function refreshMembers() {
    const rows = await listMyTeamMembers();
    setMembers(rows as Member[]);
  }

  async function refreshWorkspaceExtras(tid: string) {
    const [noteRow, resourceRows] = await Promise.all([
      getTeamNote(tid),
      listTeamResources(tid),
    ]);

    setTeamNote(noteRow?.content ?? "");
    setResources(resourceRows);
  }

  useEffect(() => {
    if (!mLoading && assigned && teamId) {
      setBusy(true);
      Promise.all([
        refreshLogs(teamId),
        refreshTasks(teamId),
        refreshMembers(),
        refreshWorkspaceExtras(teamId),
      ])
        .catch((e: any) => setError(e?.message ?? "Failed to load workspace data"))
        .finally(() => setBusy(false));
    }
  }, [mLoading, assigned, teamId]);

  async function logout() {
    await signOut();
    router.push("/login");
  }

  async function submitLog(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!assigned || !teamId) {
      setError("You must be assigned to a team before logging work.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a title for your work entry.");
      return;
    }

    try {
      setBusy(true);
      await createWorkLog({
        teamId,
        title: title.trim(),
        minutes: Number(minutes) || 0,
        link: link.trim() || undefined,
        description: description.trim() || undefined,
      });

      setTitle("");
      setMinutes(30);
      setLink("");
      setDescription("");

      await refreshLogs(teamId);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create work log.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!assigned || !teamId) {
      setError("You must be assigned to a team before creating tasks.");
      return;
    }

    if (!taskTitle.trim()) {
      setError("Enter a task title.");
      return;
    }

    try {
      setTBusy(true);

      await createTask({
        teamId,
        title: taskTitle.trim(),
        assignedTo: assignTo ? assignTo : null,
      });

      setTaskTitle("");
      setAssignTo("");
      await refreshTasks(teamId);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create task.");
    } finally {
      setTBusy(false);
    }
  }

  async function changeTaskStatus(taskId: string, status: TaskStatus) {
    setError("");

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    try {
      setTBusy(true);
      await setTaskStatus(taskId, status);
      await refreshTasks(teamId);
    } catch (err: any) {
      setError(err?.message ?? "Failed to update task status.");
      await refreshTasks(teamId);
    } finally {
      setTBusy(false);
    }
  }

  async function changeTaskAssignee(taskId: string, assignedTo: string | null) {
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
      setTBusy(true);
      await assignTask(taskId, assignedTo);
      await refreshTasks(teamId);
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign task.");
      await refreshTasks(teamId);
    } finally {
      setTBusy(false);
    }
  }

  async function saveTeamNote() {
    setError("");

    if (!assigned || !teamId) {
      setError("You must be assigned to a team before using shared notes.");
      return;
    }

    try {
      setNoteSaving(true);
      await upsertTeamNote(teamId, teamNote);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save team notes.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function addResource(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!assigned || !teamId) {
      setError("You must be assigned to a team before adding resources.");
      return;
    }

    if (!resourceTitle.trim() || !resourceUrl.trim()) {
      setError("Please add a title and URL.");
      return;
    }

    try {
      setResourceBusy(true);

      const created = await createTeamResource({
        teamId,
        title: resourceTitle.trim(),
        url: resourceUrl.trim(),
        kind: resourceKind,
        description: resourceDescription.trim() || undefined,
      });

      setResources((prev) => [created, ...prev]);
      setResourceTitle("");
      setResourceUrl("");
      setResourceKind("link");
      setResourceDescription("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to add resource.");
    } finally {
      setResourceBusy(false);
    }
  }

  async function removeResource(resourceId: string) {
    setError("");

    try {
      await deleteTeamResource(resourceId);
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete resource.");
    }
  }

  const nav = useMemo(
    () => [
      { href: "/student/dashboard", label: "Student Dashboard" },
      { href: "/student/workspace", label: "Team Workspace", active: true },
      { href: "/student/feedback", label: "Peer Feedback" },
      { href: "/student/health", label: "Team Health" },
      { href: "/student/insights", label: "Personal Insights" },
    ],
    []
  );

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
            {nav.map((n) =>
              n.active ? (
                <span key={n.href} className="font-medium text-gray-900">
                  {n.label}
                </span>
              ) : (
                <Link key={n.href} href={n.href} className="text-gray-600 hover:text-gray-900">
                  {n.label}
                </Link>
              )
            )}
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
            {nav.map((n) =>
              n.active ? (
                <span key={n.href} className="font-medium text-gray-900">
                  {n.label}
                </span>
              ) : (
                <Link key={n.href} href={n.href} className="text-gray-600 hover:text-gray-900">
                  {n.label}
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {mLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
            Loading your workspace…
          </div>
        ) : !assigned ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-900">Awaiting course assignment</h1>
            <p className="mt-2 text-sm text-gray-600">
              You must be added to a team before using the workspace. Contact your educator and ask
              to be added using your sign-up email.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              {membership!.teams.courses.code} • {membership!.teams.courses.term}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">
              Team Workspace — {membership!.teams.courses.name}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Team: <span className="font-medium">{membership!.teams.name}</span>
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Team Tasks</h2>
            <span className="text-sm text-gray-500">
              {tBusy ? "Saving…" : `${tasks.length} tasks`}
            </span>
          </div>

          {!assigned ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              You must be assigned to a team before using tasks.
            </div>
          ) : (
            <>
              <form onSubmit={submitTask} className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-900">Task</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g., Finish UI for feedback page"
                    disabled={tBusy}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-900">Assign to</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    disabled={tBusy}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name ?? m.email ?? "Member"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={tBusy}
                    className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                      tBusy ? "bg-gray-300" : "bg-gray-900 hover:bg-gray-800"
                    }`}
                  >
                    Add Task
                  </button>
                </div>
              </form>

              {tasks.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
                  No tasks yet. Add your first task above.
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
                                  {t.assigned_profile.display_name ??
                                    t.assigned_profile.email ??
                                    "Member"}
                                </span>
                              </>
                            ) : (
                              <> • Unassigned</>
                            )}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => changeTaskStatus(t.id, "todo")}
                              disabled={tBusy}
                              className={statusBtnClass(t.status === "todo")}
                            >
                              To do
                            </button>
                            <button
                              type="button"
                              onClick={() => changeTaskStatus(t.id, "doing")}
                              disabled={tBusy}
                              className={statusBtnClass(t.status === "doing")}
                            >
                              Doing
                            </button>
                            <button
                              type="button"
                              onClick={() => changeTaskStatus(t.id, "done")}
                              disabled={tBusy}
                              className={statusBtnClass(t.status === "done")}
                            >
                              Done
                            </button>
                          </div>
                        </div>

                        <div className="sm:w-[240px]">
                          <label className="text-xs font-medium text-gray-700">Reassign</label>
                          <select
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                            value={t.assigned_to ?? ""}
                            onChange={(e) =>
                              changeTaskAssignee(t.id, e.target.value ? e.target.value : null)
                            }
                            disabled={tBusy}
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
                            onClick={() => {
                              const ok = window.confirm(
                                "Delete this task assignment? This will unassign the task."
                              );
                              if (!ok) return;
                              changeTaskAssignee(t.id, null);
                            }}
                            disabled={tBusy}
                            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                          >
                            Delete assignment
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Shared team notes</h2>
              <p className="mt-1 text-sm text-gray-500">
                A shared space for meeting notes, reminders, plans, and quick updates.
              </p>
            </div>

            <button
              type="button"
              onClick={saveTeamNote}
              disabled={!assigned || noteSaving}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {noteSaving ? "Saving…" : "Save notes"}
            </button>
          </div>

          <textarea
            className="mt-4 min-h-[220px] w-full rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-900 outline-none focus:border-gray-400"
            value={teamNote}
            onChange={(e) => setTeamNote(e.target.value)}
            placeholder="Add shared notes here: meeting outcomes, action points, useful reminders, draft ideas..."
            disabled={!assigned}
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Shared resources</h2>
              <p className="mt-1 text-sm text-gray-500">
                Add useful links, file URLs, and resources for the team.
              </p>
            </div>
            <span className="text-sm text-gray-500">{resources.length} items</span>
          </div>

          {!assigned ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              You must be assigned to a team before adding shared resources.
            </div>
          ) : (
            <>
              <form onSubmit={addResource} className="mt-4 grid gap-3 lg:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">Title</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    placeholder="Lecture slides, GitHub repo, shared folder..."
                    disabled={resourceBusy}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">URL</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={resourceBusy}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Type</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={resourceKind}
                    onChange={(e) => setResourceKind(e.target.value as TeamResourceKind)}
                    disabled={resourceBusy}
                  >
                    <option value="link">Link</option>
                    <option value="resource">Resource</option>
                    <option value="file">File link</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Description (optional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={resourceDescription}
                    onChange={(e) => setResourceDescription(e.target.value)}
                    placeholder="What is this for?"
                    disabled={resourceBusy}
                  />
                </div>

                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={resourceBusy}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {resourceBusy ? "Adding…" : "Add resource"}
                  </button>
                </div>
              </form>

              {resources.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
                  No shared resources yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {resources.map((resource) => (
                    <div key={resource.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">{resource.title}</p>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
                              {resource.kind}
                            </span>
                          </div>

                          {resource.description ? (
                            <p className="mt-1 text-sm text-gray-600">{resource.description}</p>
                          ) : null}

                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block break-all text-sm text-blue-600 hover:underline"
                          >
                            {resource.url}
                          </a>

                          <p className="mt-2 text-xs text-gray-500">
                            Added {new Date(resource.created_at).toLocaleString()}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeResource(resource.id)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Log Work Entry</h2>
            <span className="text-sm text-gray-500">{busy ? "Saving…" : ""}</span>
          </div>

          <form onSubmit={submitLog} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-900">Title</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Implemented login UI"
                  disabled={!assigned || busy}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900">Minutes</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  disabled={!assigned || busy}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900">
                Link <span className="text-gray-500">(optional)</span>
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="e.g., GitHub PR / Google Doc / Figma"
                disabled={!assigned || busy}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900">
                Description <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                className="mt-1 w-full min-h-[110px] rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what you did and any outcomes."
                disabled={!assigned || busy}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!assigned || busy}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                  !assigned || busy ? "bg-gray-300" : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                Add Entry
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Work Log Entries</h2>
            <span className="text-sm text-gray-500">
              {busy ? "Loading…" : `${logs.length} entries`}
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              No entries yet. Add your first work log above.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {logs.map((l) => (
                <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{l.title}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {l.description ? (
                          l.description
                        ) : (
                          <span className="text-gray-400">No description.</span>
                        )}
                      </p>

                      <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                        <span>
                          By: {l.profiles?.display_name ?? l.profiles?.email ?? "Student"}
                        </span>
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
      </div>
    </main>
  );
}