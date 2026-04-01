"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/guards";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { getMyTeamMembership } from "@/lib/db";

type Membership = {
  team_id: string;
  teams: {
    id: string;
    name: string;
    course_id: string;
    courses: { id: string; name: string; code: string; term: string };
  };
} | null;

export default function StudentDashboard() {
  const router = useRouter();
  const { loading, profile } = useRoleGuard("student");

  const [membership, setMembership] = useState<Membership>(null);
  const [mLoading, setMLoading] = useState(true);
  const [mError, setMError] = useState("");

  useEffect(() => {
    if (!loading) {
      setMLoading(true);
      getMyTeamMembership()
        .then((m) => setMembership(m as Membership))
        .catch((e) => setMError(e.message ?? "Failed to load membership"))
        .finally(() => setMLoading(false));
    }
  }, [loading]);

  if (loading) return <div className="p-6">Loading...</div>;

  async function logout() {
    await signOut();
    router.push("/login");
  }

  const assigned = !!membership?.teams;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Student Dashboard</h1>
            <p className="text-sm text-gray-500">
              Logged in as: {profile?.email} ({profile?.role})
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {mError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{mError}</p>}

        {mLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
            Loading your team assignment…
          </div>
        ) : !assigned ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Awaiting course assignment</h2>
            <p className="mt-2 text-sm text-gray-600">
              You have not been assigned to a course/team yet. Please contact your educator and ask
              to be added using your sign-up email address.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              {membership!.teams.courses.code} • {membership!.teams.courses.term}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {membership!.teams.courses.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Team: <span className="font-medium">{membership!.teams.name}</span>
            </p>
          </div>
        )}

        {/* Navigation cards (enabled only when assigned) */}
        <section className="grid gap-4 md:grid-cols-3">
          <Link
            href="/student/workspace"
            className={`rounded-2xl border p-5 shadow-sm ${
              assigned
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-100 bg-gray-100 text-gray-400 pointer-events-none"
            }`}
          >
            <h2 className="font-semibold">Team Workspace</h2>
            <p className="mt-1 text-sm">Log work, tasks, and activity timeline.</p>
          </Link>

          <Link
            href="/student/feedback"
            className={`rounded-2xl border p-5 shadow-sm ${
              assigned
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-100 bg-gray-100 text-gray-400 pointer-events-none"
            }`}
          >
            <h2 className="font-semibold">Peer Feedback</h2>
            <p className="mt-1 text-sm">Anonymous structured feedback form.</p>
          </Link>

          <Link
            href="/student/insights"
            className={`rounded-2xl border p-5 shadow-sm ${
              assigned
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-100 bg-gray-100 text-gray-400 pointer-events-none"
            }`}
          >
            <h2 className="font-semibold">Personal Insights</h2>
            <p className="mt-1 text-sm">Contribution trends and peer ratings.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}