"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role, Profile } from "./auth";
import { getMyProfile } from "./auth";

/**
 * Simple client-side guard:
 * - loads profile
 * - redirects if no profile (not logged in)
 * - redirects if wrong role
 *
 * Later you can upgrade this with middleware / server checks.
 */
export function useRoleGuard(requiredRole?: Role) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const p = await getMyProfile();
        if (!mounted) return;

        if (!p) {
          router.replace("/login");
          return;
        }

        if (requiredRole && p.role !== requiredRole) {
          router.replace("/unauthorized");
          return;
        }

        setProfile(p);
      } catch {
        router.replace("/login");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, requiredRole]);

  return { loading, profile };
}