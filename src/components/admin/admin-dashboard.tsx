"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import {
  addFaculty,
  decideFacultyAddRequest,
  deleteFaculty,
  getAdminDashboard,
  moderateFacultyReview,
  type AdminDashboard,
} from "@/lib/data/admin";
import { reviewMetrics } from "@/lib/faculty-review-ratings";
import { DEPARTMENTS } from "@/lib/departments";
import { createClient } from "@/lib/supabase/client";

const sections = {
  overview: "Overview",
  faculty: "Faculty",
  accounts: "Students and users",
  reviews: "Reviews",
} as const;
type Section = keyof typeof sections;

export function AdminDashboardView({ initialSection = "overview" }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [showFacultyForm, setShowFacultyForm] = useState(false);
  const [facultyNotice, setFacultyNotice] = useState<string | null>(null);
  const [facultyError, setFacultyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => getAdminDashboard(createClient())).then(
      (data) => { if (active) setDashboard(data); },
      () => { if (active) setError("Unable to load administration."); },
    );
    return () => { active = false; };
  }, []);

  async function run(action?: (client: ReturnType<typeof createClient>) => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const client = createClient();
      if (action) await action(client);
      setDashboard(await getAdminDashboard(client));
    } catch {
      setDashboard(null);
      setError("Unable to complete the request. Reload to check the current state before retrying.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFaculty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "");
    setBusy(true);
    setFacultyError(null);
    setFacultyNotice(null);

    try {
      const client = createClient();
      await addFaculty(client, {
        name: value("name"),
        department: value("department"),
        designation: value("designation"),
        email: value("email"),
        summaryNote: value("summaryNote"),
      });
      setShowFacultyForm(false);
      setFacultyNotice("Faculty member added to the directory.");

      try {
        setDashboard(await getAdminDashboard(client));
      } catch {
        setFacultyNotice("Faculty member added. Reload to see the updated list.");
      }
    } catch (cause) {
      setFacultyError(cause instanceof Error ? cause.message : "Unable to add the faculty member.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFaculty(faculty: AdminDashboard["faculty"][number]) {
    if (busy || !window.confirm(`Delete ${faculty.name} from the faculty directory? This cannot be undone.`)) return;
    setBusy(true);
    setFacultyError(null);
    setFacultyNotice(null);
    try {
      const client = createClient();
      await deleteFaculty(client, faculty.id);
      setDashboard((current) => current && {
        ...current,
        faculty: current.faculty.filter(({ id }) => id !== faculty.id),
        facultyCount: Math.max(0, current.facultyCount - 1),
      });
      setFacultyNotice(`${faculty.name} was deleted from the directory.`);
      try {
        setDashboard(await getAdminDashboard(client));
      } catch {
        setFacultyNotice(`${faculty.name} was deleted. Reload to update the dashboard totals and activity.`);
      }
    } catch (cause) {
      setFacultyError(cause instanceof Error ? cause.message : "Unable to delete the faculty member.");
    } finally {
      setBusy(false);
    }
  }

  const matchingAccounts = dashboard?.accounts.filter((account) =>
    [account.display_name, account.department, account.id].some((value) =>
      value?.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title="Administration" description="Manage faculty requests, student records, and reviews." />
        <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Administration sections">
          {Object.entries(sections).map(([key, label]) => (
            <Button key={key} type="button" variant={section === key ? "primary" : "secondary"}
              aria-pressed={section === key} onClick={() => setSection(key as Section)}>
              {label}
            </Button>
          ))}
          <LinkButton href="/sign-out" variant="ghost">Sign out</LinkButton>
        </div>

        {error ? (
          <section role="alert" className="rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]">
            <p>{error}</p>
            <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => void run()}>Reload</Button>
          </section>
        ) : !dashboard ? <p role="status">Loading administration…</p> : (
          <section className="space-y-4 rounded-2xl border border-[#E0E2E6] p-5" aria-busy={busy}>
            <h2 className="text-xl font-semibold">{sections[section]}</h2>

            {section === "overview" && <>
              <dl className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Faculty", dashboard.facultyCount],
                  ["Pending faculty requests", dashboard.pendingCount],
                  ["Reviews", dashboard.reviewCount],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-xl border border-[#E0E2E6] bg-[#FAFBFC] p-4">
                    <dt>{label}</dt><dd className="mt-1 text-2xl font-semibold">{count}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="font-semibold">Recent moderation activity</h3>
              {dashboard.logs.length ? <ul className="space-y-2 text-sm">
                {dashboard.logs.map((log) => <li key={log.id}>{log.action} · {new Date(log.created_at).toLocaleString()}</li>)}
              </ul> : <p className="text-sm">No moderation activity.</p>}
            </>}

            {section === "faculty" && <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">Faculty directory</h3>
                {!showFacultyForm && <Button type="button" disabled={busy} onClick={() => {
                  setFacultyError(null);
                  setFacultyNotice(null);
                  setShowFacultyForm(true);
                }}>Add Faculty</Button>}
              </div>
              {facultyNotice && <p role="status" className="text-sm text-[#204D25]">{facultyNotice}</p>}
              {facultyError && <p role="alert" className="text-sm text-[#B42318]">{facultyError}</p>}
              {showFacultyForm && (
                <form onSubmit={submitFaculty} className="space-y-3 rounded-xl border border-[#E0E2E6] bg-[#FAFBFC] p-4">
                  <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
                    <legend className="mb-2 font-semibold">Add faculty member</legend>
                    <label className="text-sm">Faculty full name
                      <input name="name" required minLength={2} maxLength={200} className="tc-input mt-1" />
                    </label>
                    <label className="text-sm">Department
                      <select name="department" required className="tc-select mt-1" defaultValue="">
                        <option value="">Select a department</option>
                        {DEPARTMENTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="text-sm">Designation (optional)
                      <input name="designation" maxLength={120} className="tc-input mt-1" />
                    </label>
                    <label className="text-sm">Email (optional, private)
                      <input name="email" type="email" maxLength={254} className="tc-input mt-1" />
                    </label>
                    <label className="text-sm sm:col-span-2">Additional information (optional, public)
                      <textarea name="summaryNote" maxLength={2000} className="tc-textarea mt-1" />
                    </label>
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Save faculty member"}</Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowFacultyForm(false)}>Cancel</Button>
                  </div>
                </form>
              )}
              {dashboard.faculty.length === 0 ? <p className="text-sm">No faculty members in the directory.</p> : (
                <ul className="divide-y divide-[#E0E2E6] rounded-xl border border-[#E0E2E6]">
                  {dashboard.faculty.map((faculty) => (
                    <li key={faculty.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                      <span>{faculty.name} · {faculty.department}</span>
                      <div className="flex flex-wrap gap-2">
                        <LinkButton href={`/faculty/${faculty.slug}`} variant="ghost">View profile</LinkButton>
                        <Button type="button" variant="secondary" disabled={busy}
                          aria-label={`Delete ${faculty.name}`} onClick={() => void removeFaculty(faculty)}>Delete</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="font-semibold">Faculty addition requests</h3>
              <p className="text-sm text-[#5B6472]">Review faculty addition requests. Approval adds the faculty member to the directory.</p>
              {dashboard.requests.length === 0 && <p>No faculty requests.</p>}
              {dashboard.requests.map((item) => (
                <article key={item.id} className="rounded-xl border border-[#E0E2E6] p-4">
                  <h3 className="font-semibold">{item.proposed_name} · {item.proposed_department}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{item.rationale}</p>
                  <p className="mt-2 text-sm">{item.status}{item.decision_note ? ` · ${item.decision_note}` : ""}</p>
                  {item.status === "pending" && <div className="mt-3 flex flex-wrap gap-2">
                    {(["approved", "rejected"] as const).map((decision) => (
                      <Button key={decision} variant={decision === "approved" ? "primary" : "secondary"} disabled={busy}
                        onClick={() => {
                          if (window.confirm(decision === "approved" ? "Approve this faculty request?" : "Reject this faculty request?")) {
                            void run((client) => decideFacultyAddRequest(client, item.id, decision));
                          }
                        }}>{decision === "approved" ? "Approve" : "Reject"}</Button>
                    ))}
                  </div>}
                </article>
              ))}
            </>}

            {section === "accounts" && <>
              <p className="text-sm text-[#5B6472]">Review confirmation, BRAC eligibility, and moderator status for the latest 100 accounts.</p>
              <label className="block text-sm">
                Search by name, department, or account ID
                <input className="tc-input mt-1" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              {matchingAccounts?.length === 0 && <p>No matching accounts.</p>}
              <ul className="space-y-3">{matchingAccounts?.map((account) => (
                <li key={account.id} className="rounded-xl border border-[#E0E2E6] p-4">
                  <p className="font-semibold">{account.display_name || "Profile not set"} · {account.department || "No department"}</p>
                  <p className="break-all text-xs text-[#5B6472]">{account.id}</p>
                  <p className="mt-1 text-sm">{account.confirmed ? "Confirmed" : "Unconfirmed"} · {account.brac_eligible ? "BRAC eligible" : "Student access unavailable"}{account.moderator ? " · Moderator" : ""}</p>
                </li>
              ))}</ul>
            </>}

            {section === "reviews" && <>
              {dashboard.reviews.length === 0 && <p>No reviews.</p>}
              {dashboard.reviews.map((review) => {
                const visibility = review.moderation_status === "published" ? "hidden" : "published";
                const verb = visibility === "hidden" ? "Hide" : "Publish";
                return (
                  <article key={review.id} className="rounded-xl border border-[#E0E2E6] p-4">
                    <h3 className="font-semibold">{review.faculty_name} · {review.moderation_status}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{review.description}</p>
                    <p className="mt-2 text-xs text-[#5B6472]">
                      {review.rating_version === 1 ? "Legacy ratings" : "Current ratings"} ·{" "}
                      {reviewMetrics(review).map(({ label, score }) => `${label} ${score}`).join(" · ")}
                    </p>
                    <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => {
                      if (window.confirm(`${verb} this review?`)) void run((client) => moderateFacultyReview(client, review.id, visibility));
                    }}>{verb}</Button>
                  </article>
                );
              })}
            </>}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
