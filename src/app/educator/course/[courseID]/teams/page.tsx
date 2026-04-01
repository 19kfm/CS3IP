"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/guards";
import {
  createTeam,
  listTeams,
  searchStudentsByEmail,
  addStudentToTeam,
  listTeamMembers,
} from "@/lib/db";

type Team = { id: string; name: string };

type Student = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
};

type MemberProfile = { id: string; email: string | null; display_name: string | null };

export default function CourseTeamsPage() {
  const router = useRouter();
  const params = useParams();

  // IMPORTANT: because your folder is [courseID], the param key is courseID (capital D)
  const courseId = params.courseID as string;

  const { loading } = useRoleGuard("educator");

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");

  // Per-team UI state (kept in objects keyed by teamId)
  const [searchTextByTeam, setSearchTextByTeam] = useState<Record<string, string>>({});
  const [searchResultsByTeam, setSearchResultsByTeam] = useState<Record<string, Student[]>>({});
  const [membersByTeam, setMembersByTeam] = useState<Record<string, MemberProfile[]>>({});
  const [busyByTeam, setBusyByTeam] = useState<Record<string, boolean>>({});

  const safeCourseId = useMemo(() => (courseId ? String(courseId) : ""), [courseId]);

  async function refreshTeams() {
    const data = await listTeams(safeCourseId);
    setTeams(data as Team[]);
  }

 async function refreshMembers(teamId: string) {
  const m = await listTeamMembers(teamId);
  setMembersByTeam((prev) => ({ ...prev, [teamId]: m }));
}

  useEffect(() => {
    if (!loading && safeCourseId) {
      refreshTeams().catch((e) => setError(e.message ?? "Failed to load teams"));
    }
  }, [loading, safeCourseId]);

  // When teams load, pull members for each team
  useEffect(() => {
    (async () => {
      for (const t of teams) {
        await refreshMembers(t.id);
      }
    })().catch(() => {});
  }, [teams]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!safeCourseId) return <div className="p-6">Missing course ID in URL.</div>;

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!teamName.trim()) {
      setError("Enter a team name.");
      return;
    }

    try {
      await createTeam(safeCourseId, teamName.trim());
      setTeamName("");
      await refreshTeams();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create team");
    }
  }

  async function handleSearch(teamId: string) {
    setError("");
    const q = (searchTextByTeam[teamId] ?? "").trim();
    if (!q) {
      setSearchResultsByTeam((prev) => ({ ...prev, [teamId]: [] }));
      return;
    }

    try {
      setBusyByTeam((prev) => ({ ...prev, [teamId]: true }));
      const results = (await searchStudentsByEmail(q)) as Student[];
      setSearchResultsByTeam((prev) => ({ ...prev, [teamId]: results }));
    } catch (e: any) {
      setError(e.message ?? "Search failed");
    } finally {
      setBusyByTeam((prev) => ({ ...prev, [teamId]: false }));
    }
  }

  async function handleAssign(teamId: string, studentId: string) {
    setError("");
    try {
      setBusyByTeam((prev) => ({ ...prev, [teamId]: true }));
      await addStudentToTeam(teamId, studentId);

      // Refresh members list and clear search results for cleanliness
      await refreshMembers(teamId);
      setSearchResultsByTeam((prev) => ({ ...prev, [teamId]: [] }));
      setSearchTextByTeam((prev) => ({ ...prev, [teamId]: "" }));
    } catch (e: any) {
      setError(e.message ?? "Failed to assign student");
    } finally {
      setBusyByTeam((prev) => ({ ...prev, [teamId]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
          <button
            onClick={() => router.push("/educator/dashboard")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        {/* Create team */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleCreateTeam} className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., Team A"
            />
            <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Add Team
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}
        </div>

        {/* Teams list */}
        <div className="grid gap-3">
          {teams.map((t) => {
            const members = membersByTeam[t.id] ?? [];
            const searchText = searchTextByTeam[t.id] ?? "";
            const results = searchResultsByTeam[t.id] ?? [];
            const busy = busyByTeam[t.id] ?? false;

            return (
              <div key={t.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <span className="text-sm text-gray-500">{members.length} members</span>
                </div>

                {/* Members */}
                <div className="mt-3 space-y-2">
                  {members.length === 0 ? (
                    <p className="text-sm text-gray-600">No members assigned yet.</p>
                  ) : (
                    members.map((m) => (
                        <div
                            key={m.id}
                            className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                            <div>
                            <p className="text-sm font-medium text-gray-900">{m.display_name ?? "Student"}</p>
                            <p className="text-xs text-gray-600">{m.email ?? ""}</p>
                            </div>
                        </div>
                        ))
                  )}
                </div>

                {/* Assign student */}
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-medium text-gray-900">Assign student by email</p>

                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      value={searchText}
                      onChange={(e) =>
                        setSearchTextByTeam((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      placeholder="Type student email (e.g., student1@teamup.test)"
                    />
                    <button
                      type="button"
                      onClick={() => handleSearch(t.id)}
                      disabled={busy}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Search
                    </button>
                  </div>

                  {/* Results */}
                  {results.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {results.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {s.display_name ?? "Student"}
                            </p>
                            <p className="text-xs text-gray-600">{s.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAssign(t.id, s.id)}
                            disabled={busy}
                            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.length === 0 && searchText.trim() && (
                    <p className="mt-3 text-sm text-gray-600">No students found for that email.</p>
                  )}
                </div>
              </div>
            );
          })}

          {teams.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600">
              No teams yet. Add your first team above.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}