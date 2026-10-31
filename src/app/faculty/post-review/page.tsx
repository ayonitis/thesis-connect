
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import {
  getFacultyDirectory,
  getOwnFacultyAddRequests,
  getOwnFacultyReviews,
  submitFacultyAddRequest,
  type OwnFacultyAddRequest,
  type OwnFacultyReview,
  type FacultyWithReviews,
} from "@/lib/data/faculty";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS, type DepartmentValue } from "@/lib/departments";

export default function FacultyPostReviewHubPage() {
  const router = useRouter();

  const [faculty, setFaculty] = useState<FacultyWithReviews[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectError, setSelectError] = useState("");

  const [requestName, setRequestName] = useState("");
  const [requestDepartment, setRequestDepartment] = useState<DepartmentValue | "">("");
  const [requestContext, setRequestContext] = useState("");
  const [researchInterests, setResearchInterests] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);
  const [reviews, setReviews] = useState<OwnFacultyReview[]>([]);
  const [requests, setRequests] = useState<OwnFacultyAddRequest[]>([]);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFaculty() {
      try {
        const supabase = createClient();
        const result = await getFacultyDirectory(supabase);

        if (active) {
          setFaculty(result.faculty);
          setLoadError("");
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load the faculty directory.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFaculty();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getOwnFacultyReviews(createClient()), getOwnFacultyAddRequests(createClient())])
      .then(([ownReviews, ownRequests]) => { if (active) { setReviews(ownReviews); setRequests(ownRequests); } })
      .catch((error) => { if (active) setHistoryError(error instanceof Error ? error.message : "Unable to load your faculty activity."); });
    return () => { active = false; };
  }, []);

  const facultyOptions = [...faculty].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const continueToReview = () => {
    if (!selectedSlug) {
      setSelectError("Please select a supervisor first.");
      return;
    }

    setSelectError("");
    router.push(`/faculty/${selectedSlug}/review`);
  };

  const submitRequest = async () => {
    if (
      !requestName.trim() ||
      !requestDepartment.trim() ||
      !requestContext.trim()
    ) {
      setRequestError("Please complete all request fields.");
      return;
    }

    setRequestSaving(true); setRequestError("");
    try {
      await submitFacultyAddRequest(createClient(), { proposedName: requestName, proposedDepartment: requestDepartment as DepartmentValue, proposedResearchInterests: researchInterests.split(",").map((item) => item.trim()).filter(Boolean), rationale: requestContext });
      setRequestSubmitted(true);
      setRequests(await getOwnFacultyAddRequests(createClient()));
    } catch (error) { setRequestError(error instanceof Error ? error.message : "Unable to submit your request."); }
    finally { setRequestSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/faculty"
          title="Post Your Review"
          description="Choose an existing supervisor to write or edit your review, or request a missing faculty profile."
        />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <h2 className="text-xl font-semibold text-[#1F2937]">
            Select a listed supervisor
          </h2>

          <p className="mt-1 text-sm text-[#5B6472]">
            You can submit one review per faculty member and edit your own review later.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-[#64748B]">
              Loading faculty directory...
            </p>
          ) : loadError ? (
            <div className="mt-4 rounded-xl border border-[#F1C7C7] bg-[#FFF5F5] p-4">
              <p className="text-sm text-[#B42318]">{loadError}</p>
            </div>
          ) : faculty.length === 0 ? (
            <div className="mt-4 rounded-xl border border-[#E0E2E6] bg-[#F9FAFB] p-4">
              <p className="text-sm text-[#64748B]">
                No faculty members are currently listed.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={selectedSlug}
                onChange={(event) => {
                  setSelectedSlug(event.target.value);
                  setSelectError("");
                }}
                className="tc-select"
              >
                <option value="">Choose a supervisor</option>
                {facultyOptions.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name} ({item.department})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="lightBlue"
                onClick={continueToReview}
              >
                Continue to Review
              </Button>
            </div>
          )}

          {selectError ? (
            <p className="mt-2 text-xs text-[#B42318]">{selectError}</p>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[#D9E7F5] bg-[#F4F9FE] p-5">
          <h2 className="text-xl font-semibold text-[#1F2937]">
            Can&apos;t find your supervisor?
          </h2>

          <p className="mt-1 text-sm text-[#5B6472]">
            Submit a request for authorized review. Students cannot directly
            create unrestricted official faculty records from this interface.
          </p>

          {requestSubmitted ? (
            <div className="mt-4 rounded-xl border border-[#BCD6EB] bg-white p-4 text-sm text-[#334155]">
              Your request was submitted and is awaiting an administrator decision.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">
                  Supervisor name
                </span>
                <input
                  className="tc-input"
                  value={requestName}
                  onChange={(event) => setRequestName(event.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">
                  Department
                </span>
                <select className="tc-select" value={requestDepartment} onChange={(event) => setRequestDepartment(event.target.value as DepartmentValue)}><option value="">Choose a department</option>{DEPARTMENTS.map((department) => <option key={department.value} value={department.value}>{department.label}</option>)}</select>
              </label>

              <label className="text-sm"><span className="mb-1.5 block font-medium text-[#2F3A4A]">Research interests (optional, comma-separated)</span><input className="tc-input" value={researchInterests} onChange={(event) => setResearchInterests(event.target.value)} /></label>

              <label className="text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">
                  Why this supervisor should be added
                </span>
                <textarea
                  className="tc-textarea min-h-24"
                  value={requestContext}
                  onChange={(event) => setRequestContext(event.target.value)}
                />
              </label>

              {requestError ? (
                <p className="text-xs text-[#B42318]">{requestError}</p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => void submitRequest()} disabled={requestSaving}>
                  {requestSaving ? "Submitting…" : "Submit Request"}
                </Button>

                <LinkButton href="/faculty" variant="ghost">
                  Back to directory
                </LinkButton>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <h2 className="text-xl font-semibold text-[#1F2937]">My Faculty Activity</h2>
          {historyError ? <p role="alert" className="mt-3 text-sm text-[#B42318]">{historyError}</p> : null}
          <div className="mt-4 grid gap-5 md:grid-cols-2"><div><h3 className="font-semibold text-[#1F2937]">My reviews</h3>{reviews.length ? <ul className="mt-2 space-y-2 text-sm">{reviews.map((review) => <li key={review.id}><LinkButton href={review.facultySlug ? `/faculty/${review.facultySlug}/review` : "/faculty"} variant="ghost">{review.facultyName ?? "Faculty review"} · {review.moderationStatus}</LinkButton></li>)}</ul> : <p className="mt-2 text-sm text-[#5B6472]">No reviews submitted yet.</p>}</div><div><h3 className="font-semibold text-[#1F2937]">My faculty requests</h3>{requests.length ? <ul className="mt-2 space-y-2 text-sm text-[#4B5563]">{requests.map((request) => <li key={request.id}>{request.proposedName} · <span className="capitalize">{request.status}</span>{request.decisionNote ? ` — ${request.decisionNote}` : ""}</li>)}</ul> : <p className="mt-2 text-sm text-[#5B6472]">No faculty requests submitted yet.</p>}</div></div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
