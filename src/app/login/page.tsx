"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, getMyProfile, upsertMyProfile } from "@/lib/auth";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [educatorCode, setEducatorCode] = useState("");

  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const educatorCodeExpected = useMemo(
    () => (process.env.NEXT_PUBLIC_EDUCATOR_CODE ?? "").trim(),
    []
  );

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");

    if (next === "signin") {
      setEducatorCode("");
      setDisplayName("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedEducatorCode = educatorCode.trim();

    try {
      if (!trimmedEmail) {
        setError("Please enter your email.");
        return;
      }

      if (!password) {
        setError("Please enter your password.");
        return;
      }

      if (mode === "signin") {
        await signIn(trimmedEmail, password);
      } else {
        if (!trimmedDisplayName) {
          setError("Please enter a display name.");
          return;
        }

        // Blank code = student
        // Correct code = educator
        // Wrong non-blank code = block signup and show error
        if (
          trimmedEducatorCode &&
          trimmedEducatorCode !== educatorCodeExpected
        ) {
          setError("That educator access code is incorrect.");
          return;
        }

        const role =
          trimmedEducatorCode && trimmedEducatorCode === educatorCodeExpected
            ? "educator"
            : "student";

        await signUp(trimmedEmail, password);
        await upsertMyProfile(role, trimmedDisplayName);
      }

      const profile = await getMyProfile();
      if (!profile) throw new Error("No profile found.");

      router.push(profile.role === "educator" ? "/educator/dashboard" : "/student/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white">
            <span className="text-lg font-bold">T</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">TeamUp</h1>
          <p className="mt-1 text-sm text-gray-500">Educational Teamwork Support System</p>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`rounded-lg py-2 text-sm font-medium ${
              mode === "signin" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-lg py-2 text-sm font-medium ${
              mode === "signup" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-gray-900">Display name</label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Sarah Chen"
                autoComplete="name"
              />
              <p className="mt-1 text-xs text-gray-500">
                This is what teammates and educators will see.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-900">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">Password</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-gray-900">
                Educator access code <span className="text-gray-500">(optional)</span>
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400"
                type="password"
                value={educatorCode}
                onChange={(e) => setEducatorCode(e.target.value)}
                placeholder="Enter code if you are an educator"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to create a student account.
              </p>
            </div>
          )}

          {mode === "signin" && (
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setInfo("Password reset will be added soon.");
                }}
                className="text-gray-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {info && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{info}</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800"
            type="submit"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>

          {mode === "signin" ? (
            <p className="pt-2 text-center text-sm text-gray-600">
              Don’t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-medium text-gray-900 hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="pt-2 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-medium text-gray-900 hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </form>
      </div>
    </main>
  );
}