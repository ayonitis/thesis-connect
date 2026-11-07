"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DEPARTMENTS, type DepartmentValue } from "@/lib/departments";
import { getCurrentProfile, getCurrentStudentProfile, saveCurrentStudentProfile } from "@/lib/data/profile";
import { getSafeInternalRedirectPath } from "@/lib/auth/redirect";
import { clearRejectedBracSession } from "@/lib/auth/require-brac-user";
import { createClient } from "@/lib/supabase/client";
import { parseProfileCgpa, validateStudentProfileDetails } from "@/lib/profile-completion";

export function StudentProfileForm({ onboarding = false }: { onboarding?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState<DepartmentValue | "">("");
  const [cgpa, setCgpa] = useState("");
  const [semester, setSemester] = useState("");
  const [bracLike, setBracLike] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const supabase = createClient();
        const [profile, privateProfile] = await Promise.all([
          getCurrentProfile(supabase), getCurrentStudentProfile(supabase),
        ]);
        if (!active) return;
        if (!profile) throw new Error("Your profile is not available yet. Please try again shortly.");
        setName(profile.displayName === "Student" && onboarding ? "" : profile.displayName);
        setDepartment(profile.department ?? "");
        setStudentId(privateProfile.student?.studentId ?? "");
        setCgpa(privateProfile.details?.cgpa?.toString() ?? "");
        setSemester(privateProfile.details?.currentSemester ?? "");
        setBracLike(privateProfile.details?.bracLike ?? "");
        setLoaded(true);
      } catch {
        if (active) setError("Your profile could not be loaded. Please refresh and try again.");
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [onboarding]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setSuccess(null);
    if (!name.trim() || !studentId.trim() || !department) {
      setError("Enter your full name, student ID and department."); return;
    }
    let details;
    try {
      details = { cgpa: parseProfileCgpa(cgpa), currentSemester: semester.trim(), bracLike: bracLike.trim() };
      validateStudentProfileDetails(details);
    } catch (validationError) {
      setError((validationError as Error).message); return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      await saveCurrentStudentProfile(supabase, { displayName: name, studentId, department, details });
      setName(name.trim()); setStudentId(studentId.trim());
      setCgpa(details.cgpa.toFixed(2)); setSemester(details.currentSemester); setBracLike(details.bracLike);
      if (onboarding) {
        const next = getSafeInternalRedirectPath(new URLSearchParams(window.location.search).get("next"), "/");
        router.replace(next.startsWith("/profile/complete") ? "/" : next);
        router.refresh();
      } else {
        setSuccess("Your profile has been saved.");
        router.refresh();
      }
    } catch {
      setError("Your profile could not be fully saved. Your changes are still here; please try again.");
    } finally { setSaving(false); }
  };

  const logout = async () => {
    setLoggingOut(true);
    setError(null);
    setSuccess(null);
    try {
      if (await clearRejectedBracSession(createClient())) {
        router.replace("/");
        router.refresh();
        return;
      }
    } catch {
      // Client initialization can fail before session cleanup starts.
    }
    setError("Unable to sign out. Please try again.");
    setLoggingOut(false);
  };

  return <div className="min-h-screen bg-white">
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader fallbackHref="/" title={onboarding ? "Set up your student profile" : "Your profile"}
        description={onboarding ? "Tell us a little about yourself before getting started." : "View and update your student information."} />
      <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5 sm:p-6">
        {loading ? <p role="status" className="text-sm text-[#4B5563]">Loading your profile…</p> : null}
        {error ? <p role="alert" className="mb-4 text-sm text-[#B42318]">{error}</p> : null}
        {loaded ? <form onSubmit={save} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
            <legend className="sr-only">Student profile information</legend>
            <label className="block text-sm"><span className="mb-1.5 block font-medium">Full Name</span>
              <input className="tc-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={100} required /></label>
            <label className="block text-sm"><span className="mb-1.5 block font-medium">Student ID</span>
              <input className="tc-input" value={studentId} onChange={e => setStudentId(e.target.value)} autoComplete="off" maxLength={64} required /></label>
            <label className="block text-sm"><span className="mb-1.5 block font-medium">Department</span>
              <select className="tc-select" value={department} onChange={e => setDepartment(e.target.value as DepartmentValue | "")} required>
                <option value="">Select your department</option>
                {DEPARTMENTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select></label>
            <fieldset className="space-y-4">
              <legend className="sr-only">Additional private details</legend>
              <label className="block text-sm"><span className="mb-1.5 block font-medium">CGPA</span>
                <input className="tc-input" type="number" inputMode="decimal" min="0" max="4" step="0.01" value={cgpa} onChange={e => setCgpa(e.target.value)} required />
                <span className="mt-1 block text-xs text-[#64748B]">Stored privately and never shown in public rooms or reviews.</span></label>
              <label className="block text-sm"><span className="mb-1.5 block font-medium">Current Semester</span>
                <input className="tc-input" type="text" placeholder="9th/10th/11th" value={semester} onChange={e => setSemester(e.target.value)} maxLength={40} required /></label>
              <label className="block text-sm"><span className="mb-1.5 block font-medium">One thing you like about BRAC University</span>
                <textarea className="tc-textarea resize-y" rows={3} placeholder="One thing you like about BRAC University" value={bracLike} onChange={e => setBracLike(e.target.value)} maxLength={500} /></label>
            </fieldset>
          </fieldset>
          {success ? <p role="status" className="text-sm text-[#166534]">{success}</p> : null}
          {onboarding ? (
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save and continue"}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button type="submit" disabled={saving || loggingOut}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={logout} disabled={saving || loggingOut}>
                {loggingOut ? "Signing out…" : "Logout"}
              </Button>
            </div>
          )}
        </form> : null}
      </section>
    </main><Footer />
  </div>;
}
