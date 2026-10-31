"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DEPARTMENTS, type DepartmentValue } from "@/lib/departments";
import {
  getCurrentProfile,
  getCurrentStudentPrivate,
  updateCurrentProfile,
  updateCurrentStudentPrivate,
} from "@/lib/data/profile";
import { getSafeInternalRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

function suggestedDisplayName(metadata: Record<string, unknown> | undefined) {
  const candidate = metadata?.display_name ?? metadata?.full_name ?? metadata?.name;
  return typeof candidate === "string" ? candidate.trim().slice(0, 100) : "";
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState<DepartmentValue | "">("");
  const [studentId, setStudentId] = useState("");
  const [loadedStudentId, setLoadedStudentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const [profile, studentPrivate, userResult] = await Promise.all([
          getCurrentProfile(supabase),
          getCurrentStudentPrivate(supabase),
          supabase.auth.getUser(),
        ]);

        if (!profile) {
          setError("Your profile is not available yet. Please try again in a moment.");
          return;
        }

        const fallbackName = suggestedDisplayName(userResult.data.user?.user_metadata);
        setDisplayName(profile.displayName === "Student" && fallbackName ? fallbackName : profile.displayName);
        setDepartment(profile.department ?? "");
        const existingStudentId = studentPrivate?.studentId ?? "";
        setStudentId(existingStudentId);
        setLoadedStudentId(existingStudentId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load your profile.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const save = async () => {
    setError(null);
    setSuccess(null);

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }
    if (!department) {
      setError("Please select your department.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const trimmedStudentId = studentId.trim();
      if (trimmedStudentId && trimmedStudentId !== loadedStudentId) {
        await updateCurrentStudentPrivate(supabase, trimmedStudentId);
        setLoadedStudentId(trimmedStudentId);
      }

      await updateCurrentProfile(supabase, { displayName: trimmedDisplayName, department });

      setSuccess("Your profile is complete.");
      const next = getSafeInternalRedirectPath(new URLSearchParams(window.location.search).get("next"), "/");
      window.setTimeout(() => {
        router.replace(next);
        router.refresh();
      }, 500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/"
          title="Complete your profile"
          description="Add the information required for student-specific Thesis Connect features."
        />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          {isLoading ? <p className="text-sm text-[#4B5563]">Loading your profile...</p> : null}

          {!isLoading ? (
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">Display name</span>
                <input
                  className="tc-input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">Department</span>
                <select
                  className="tc-select"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value as DepartmentValue | "")}
                >
                  <option value="">Select your department</option>
                  {DEPARTMENTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">Student ID (optional)</span>
                <input
                  className="tc-input"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  maxLength={64}
                  autoComplete="off"
                />
                <span className="mt-1 block text-xs text-[#64748B]">This is stored privately and is not shown publicly.</span>
              </label>

              {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
              {success ? <p className="text-sm text-[#166534]">{success}</p> : null}

              <Button type="button" className="w-full" onClick={save} disabled={isSaving || Boolean(success)}>
                {isSaving ? "Saving profile..." : "Save and continue"}
              </Button>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  );
}
