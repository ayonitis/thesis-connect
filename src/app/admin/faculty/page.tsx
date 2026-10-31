"use client";

import { useCallback, useEffect, useState } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { decideFacultyAddRequest, getAdminFacultyData, moderateFacultyReview } from "@/lib/data/faculty";
import { createClient } from "@/lib/supabase/client";

type Dashboard = Awaited<ReturnType<typeof getAdminFacultyData>>;

export default function FacultyAdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setDashboard(await getAdminFacultyData(createClient())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load faculty administration."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void getAdminFacultyData(createClient())
      .then((data) => { if (!cancelled) { setDashboard(data); setError(null); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load faculty administration."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    if (working || !window.confirm(`${decision === "approved" ? "Approve" : "Reject"} this faculty request?`)) return;
    try { setWorking(id); await decideFacultyAddRequest(createClient(), id, decision, ""); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save the decision."); }
    finally { setWorking(null); }
  };
  const moderate = async (id: string, visibility: "published" | "hidden") => {
    if (working || !window.confirm(`${visibility === "hidden" ? "Hide" : "Publish"} this review?`)) return;
    try { setWorking(id); await moderateFacultyReview(createClient(), id, visibility); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save review visibility."); }
    finally { setWorking(null); }
  };

  return <div className="min-h-screen bg-white"><main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader fallbackHref="/faculty" title="Faculty Administration" description="Administrative decisions are enforced by the database RPCs and RLS policies." />
    {loading ? <p role="status" className="text-sm text-[#5B6472]">Loading administration…</p> : null}
    {error ? <section role="alert" className="rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]"><p>{error}</p><Button className="mt-3" variant="secondary" onClick={() => void load()}>Try again</Button></section> : null}
    {dashboard ? <div className="space-y-6"><section className="grid gap-3 sm:grid-cols-4">{[["Faculty", dashboard.facultyCount], ["Pending requests", dashboard.requests.filter((item) => item.status === "pending").length], ["Published reviews", dashboard.reviews.filter((item) => item.moderationStatus === "published").length], ["Hidden reviews", dashboard.reviews.filter((item) => item.moderationStatus === "hidden").length]].map(([label, count]) => <article key={String(label)} className="rounded-xl border border-[#E0E2E6] bg-[#FAFBFC] p-4"><p className="text-sm text-[#5B6472]">{label}</p><p className="mt-1 text-2xl font-semibold text-[#1F2937]">{count}</p></article>)}</section>
      <Section title="Faculty addition requests"><div className="space-y-3">{dashboard.requests.map((request) => <article key={request.id} className="rounded-xl border border-[#E0E2E6] p-4"><p className="font-semibold">{request.proposedName} · {request.proposedDepartment}</p><p className="mt-1 text-sm text-[#4B5563]">{request.rationale}</p><p className="mt-2 text-xs text-[#64748B]">{request.status}{request.decisionNote ? ` · ${request.decisionNote}` : ""}</p>{request.status === "pending" ? <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={working !== null} onClick={() => void decide(request.id, "rejected")}>Reject</Button><Button disabled={working !== null} onClick={() => void decide(request.id, "approved")}>Approve</Button></div> : null}</article>)}{dashboard.requests.length === 0 ? <p className="text-sm text-[#5B6472]">No faculty requests.</p> : null}</div></Section>
      <Section title="Review moderation"><div className="space-y-3">{dashboard.reviews.map((review) => <article key={review.id} className="rounded-xl border border-[#E0E2E6] p-4"><p className="font-semibold">{review.facultyName ?? "Faculty review"} · {review.moderationStatus}</p><p className="mt-2 text-sm text-[#4B5563]">{review.description}</p><p className="mt-2 text-xs text-[#64748B]">Clarity {review.clarity}, responsiveness {review.responsiveness}, fairness {review.fairness}, workload {review.workload}</p><div className="mt-3"><Button variant={review.moderationStatus === "published" ? "secondary" : "primary"} disabled={working !== null} onClick={() => void moderate(review.id, review.moderationStatus === "published" ? "hidden" : "published")}>{review.moderationStatus === "published" ? "Hide" : "Publish"}</Button></div></article>)}{dashboard.reviews.length === 0 ? <p className="text-sm text-[#5B6472]">No reviews.</p> : null}</div></Section>
      <Section title="Recent moderation activity"><ul className="space-y-2 text-sm text-[#4B5563]">{dashboard.logs.map((log) => <li key={log.id}>{log.action} · {new Date(log.createdAt).toLocaleString()}</li>)}{dashboard.logs.length === 0 ? <li>No moderation activity.</li> : null}</ul></Section>
    </div> : null}
  </main><Footer /></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5"><h2 className="text-xl font-semibold text-[#1F2937]">{title}</h2><div className="mt-4">{children}</div></section>; }
