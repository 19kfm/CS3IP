"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/guards";
import { createCourse } from "@/lib/db";

export default function CreateCoursePage() {
  const router = useRouter();
  const { loading } = useRoleGuard("educator");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [term, setTerm] = useState("");
  const [error, setError] = useState("");

  if (loading) return <div className="p-6">Loading...</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !code.trim() || !term.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      await createCourse({ name: name.trim(), code: code.trim(), term: term.trim() });
      router.push("/educator/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create course");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Create Course</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Course name</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Software Engineering"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Course code</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CS3IP"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Term</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Spring 2026"
            />
          </div>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="flex gap-3">
            <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Create
            </button>
            <button
              type="button"
              onClick={() => router.push("/educator/dashboard")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}