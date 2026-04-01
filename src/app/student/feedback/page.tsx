"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/guards";
import {
  listMyTeammates,
  submitPeerFeedback,
  getMyReceivedFeedback,
  type ReceivedFeedbackResult,
} from "@/lib/db";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Teammate = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type Likert = 1 | 2 | 3 | 4 | 5;

const TAGS = [
  "Missed deadlines",
  "Poor communication",
  "Unequal workload",
  "Quality issues",
] as const;

function scoreText(value: number | null) {
  return value == null ? "—" : value.toFixed(1);
}

export default function StudentFeedbackPage() {
  const router = useRouter();
  const { loading, profile } = useRoleGuard("student");

  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [receivedData, setReceivedData] = useState<ReceivedFeedbackResult | null>(null);
  const [pageBusy, setPageBusy] = useState(true);

  const [toStudentId, setToStudentId] = useState("");

  const selectedTeammate = useMemo(
    () => teammates.find((t) => t.id === toStudentId) ?? null,
    [teammates, toStudentId]
  );

  const [reliability, setReliability] = useState<Likert>(3);
  const [communication, setCommunication] = useState<Likert>(3);
  const [workQuality, setWorkQuality] = useState<Likert>(3);

  const [comment, setComment] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [concernTags, setConcernTags] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadPageData() {
    setError("");
    setPageBusy(true);

    try {
      const [teammatesData, received] = await Promise.all([
        listMyTeammates(),
        getMyReceivedFeedback(),
      ]);

      setTeammates(teammatesData as Teammate[]);
      setReceivedData(received);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load feedback page");
    } finally {
      setPageBusy(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      loadPageData();
    }
  }, [loading]);

  if (loading) return <div className="p-6">Loading...</div>;

  async function logout() {
    await signOut();
    router.push("/login");
  }

  function toggleTag(tag: string) {
    setConcernTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!toStudentId) {
      setError("Please select a teammate.");
      return;
    }

    try {
      setSubmitting(true);

      await submitPeerFeedback({
        toStudentId,
        reliability,
        communication,
        workQuality,
        comment,
        concernTags,
        privateNote,
      });

      setSuccess("Feedback submitted anonymously.");
      setComment("");
      setPrivateNote("");
      setConcernTags([]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  const summary = receivedData?.summary;
  const entries = receivedData?.entries ?? [];

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
            <a href="/student/dashboard" className="text-gray-600 hover:text-gray-900">
              Student Dashboard
            </a>
            <a href="/student/workspace" className="text-gray-600 hover:text-gray-900">
              Team Workspace
            </a>
            <a href="/student/feedback" className="font-medium text-gray-900">
              Peer Feedback
            </a>
            <a href="/student/health" className="text-gray-600 hover:text-gray-900">
              Team Health
            </a>
            <a href="/student/insights" className="text-gray-600 hover:text-gray-900">
              Personal Insights
            </a>
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
            <span className="font-medium text-gray-900">Feedback</span>
            <a href="/student/health" className="text-gray-600 hover:text-gray-900">
              Health
            </a>
            <a href="/student/insights" className="text-gray-600 hover:text-gray-900">
              Insights
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-4">
        {pageBusy ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : null}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-sm">
              i
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Feedback guidelines</h2>
              <p className="mt-1 text-sm text-gray-600">
                Your responses are anonymised before being shared with team members.
                Private notes to the educator will only be visible to instructors and remain confidential.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">Select teammate</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    value={toStudentId}
                    onChange={(e) => setToStudentId(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {teammates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name ?? t.email ?? "Teammate"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Evaluation period</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    defaultValue="this_week"
                    onChange={() => {}}
                  >
                    <option value="this_week">This week</option>
                    <option value="last_week">Last week</option>
                    <option value="last_2_weeks">Last 2 weeks</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    (MVP note: period selection is UI-only for now.)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
              {selectedTeammate?.display_name?.[0]?.toUpperCase() ??
                selectedTeammate?.email?.[0]?.toUpperCase() ??
                "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {selectedTeammate
                  ? selectedTeammate.display_name ?? selectedTeammate.email ?? "Teammate"
                  : "Select a teammate to begin"}
              </p>
              <p className="text-xs text-gray-500">
                {selectedTeammate ? "Provide fair, constructive feedback." : "You must be assigned to a team."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <LikertRow
              title="Reliability"
              subtitle="Completes tasks on time and meets commitments."
              value={reliability}
              setValue={setReliability}
            />
            <LikertRow
              title="Communication"
              subtitle="Responds promptly and communicates effectively."
              value={communication}
              setValue={setCommunication}
            />
            <LikertRow
              title="Quality of work"
              subtitle="Delivers high-quality, well-thought-out contributions."
              value={workQuality}
              setValue={setWorkQuality}
            />

            <div>
              <label className="text-sm font-medium text-gray-900">
                Comment for teammate to see
              </label>
              <p className="text-xs text-gray-500 mt-1">
                This stays anonymous, but the teammate can see the comment itself.
              </p>
              <textarea
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="E.g., consistently delivers on time and communicates clearly…"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900">Concern tags (optional)</label>
              <p className="text-xs text-gray-500 mt-1">Select any areas that may need attention.</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {TAGS.map((tag) => {
                  const checked = concernTags.includes(tag);
                  return (
                    <label
                      key={tag}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-sm cursor-pointer ${
                        checked ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTag(tag)}
                        className="h-4 w-4"
                      />
                      <span className="text-gray-900">{tag}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900">
                Private note for educator only <span className="text-gray-500">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Only instructors can see this. It will not be shared with teammates.
              </p>
              <textarea
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                rows={3}
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="E.g., workload imbalance has been affecting our progress…"
              />
            </div>

            {success && (
              <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            <button
              disabled={submitting || teammates.length === 0 || !toStudentId}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              type="submit"
            >
              {submitting ? "Submitting…" : "Submit feedback"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Feedback I’ve received</h2>
          <p className="mt-1 text-sm text-gray-600">
            Feedback is shown anonymously. Educator-only notes are not shown here.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Entries" value={String(summary?.count ?? 0)} />
            <MiniStat label="Reliability" value={scoreText(summary?.avg_reliability ?? null)} />
            <MiniStat label="Communication" value={scoreText(summary?.avg_communication ?? null)} />
            <MiniStat label="Work quality" value={scoreText(summary?.avg_work_quality ?? null)} />
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">Common concern tags</p>

            {summary?.top_tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.top_tags.map((tag) => (
                  <span
                    key={tag.tag}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
                  >
                    {tag.tag} ({tag.n})
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No concern tags yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Anonymous received entries</h2>
            <span className="text-sm text-gray-500">{entries.length} total</span>
          </div>

          {entries.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
              No feedback has been received yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {entries.map((entry, index) => (
                <div
                  key={`${entry.created_at}-${index}`}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Anonymous teammate feedback</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniPill label="Reliability" value={entry.reliability} />
                      <MiniPill label="Communication" value={entry.communication} />
                      <MiniPill label="Quality" value={entry.work_quality} />
                      <MiniPill label="Average" value={Number(entry.average_score.toFixed(1))} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900">Visible comment</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {entry.comment ? entry.comment : "No comment left."}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900">Concern tags</p>
                    {entry.concern_tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entry.concern_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">No concern tags.</p>
                    )}
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

function LikertRow({
  title,
  subtitle,
  value,
  setValue,
}: {
  title: string;
  subtitle: string;
  value: Likert;
  setValue: (n: Likert) => void;
}) {
  const options: { v: Likert; label: string }[] = [
    { v: 1, label: "Poor" },
    { v: 2, label: "Fair" },
    { v: 3, label: "Good" },
    { v: 4, label: "Very Good" },
    { v: 5, label: "Excellent" },
  ];

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        {options.map((o) => (
          <label key={o.v} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name={title}
              checked={value === o.v}
              onChange={() => setValue(o.v)}
            />
            <span>
              {o.v} - {o.label}
            </span>
          </label>
        ))}
      </div>
    </div>
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

function MiniPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}