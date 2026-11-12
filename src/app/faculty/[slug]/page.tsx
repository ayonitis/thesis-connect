
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/button";
import {
  getFacultyBySlug,
  type FacultyWithReviews,
} from "@/lib/data/faculty";
import { createClient } from "@/lib/supabase/client";
import { ratingTone } from "@/lib/review-utils";
import { reviewMetrics, summarizeFacultyReviews } from "@/lib/faculty-review-ratings";

export default function FacultyProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [faculty, setFaculty] = useState<FacultyWithReviews | null>(null);
  const [canViewReviews, setCanViewReviews] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFaculty() {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const result = await getFacultyBySlug(supabase, slug);

        if (!active) return;

        setFaculty(result.faculty);
        setCanViewReviews(result.canViewReviews);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load this faculty profile.",
        );
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
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF]">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader fallbackHref="/faculty" title="Faculty Profile" />
          <p className="text-sm text-[#5B6472]">
            Loading faculty profile...
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FFFFFF]">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader fallbackHref="/faculty" title="Unable to Load Profile" />
          <p role="alert" className="text-sm text-[#B42318]">
            {error}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!faculty) {
    return (
      <div className="min-h-screen bg-[#FFFFFF]">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader fallbackHref="/faculty" title="Faculty Not Found" />
          <p className="text-sm text-[#4B5563]">
            No faculty profile exists for this route.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const summaries = summarizeFacultyReviews(faculty.reviews);
  const profile = faculty.official_profile;
  const email = profile?.email;
  const contact = email && /^[a-z0-9._+-]+@bracu\.ac\.bd$/i.test(email) ? email : null;
  const details = [
    ["Designation", profile?.designation],
    ...(profile?.address ? [["Address", profile.address]] : []),
    ["Role", profile?.roles?.join(", ")],
    ["Level", profile?.levels?.join(", ")],
    ["Type", profile?.types?.join(", ")],
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/faculty"
          title={faculty.name}
          description="View faculty information and published student reviews."
          rightSlot={
            <LinkButton href={`/faculty/${faculty.slug}/review`} variant="lightBlue">
              Post a Review
            </LinkButton>
          }
        />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <p className="text-sm text-[#4B5563]">
            <span className="font-semibold text-[#1F2937]">Department:</span>{" "}
            {faculty.department}
          </p>

          <dl className="mt-4 grid gap-4 text-sm text-[#4B5563] sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold text-[#1F2937]">{label}</dt>
                <dd className="whitespace-pre-line">{value || "Not listed in the official directory"}</dd>
              </div>
            ))}
            <div>
              <dt className="font-semibold text-[#1F2937]">Official BRACU email</dt>
              <dd>
                {contact ? <a className="break-all underline" href={`mailto:${contact}`}>{contact}</a> : "Not listed"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-[#1F2937]">Research interests</dt>
              <dd>
                {profile?.research_interests?.length ? (
                  <ul className="mt-1 list-inside list-disc">
                    {profile.research_interests.map((interest) => <li key={interest}>{interest}</li>)}
                  </ul>
                ) : "Not listed in the official directory"}
              </dd>
            </div>
          </dl>

          {faculty.summary_note ? (
            <section className="mt-6 rounded-xl border border-[#E2E6EB] bg-[#FAFBFC] p-4">
              <h2 className="text-xl font-semibold text-[#1F2937]">
                Faculty Summary
              </h2>
              <p className="mt-1 text-sm text-[#4B5563]">
                {faculty.summary_note}
              </p>
            </section>
          ) : null}

          {canViewReviews ? (
            <section className="mt-6 rounded-xl border border-[#E2E6EB] bg-[#FAFBFC] p-4">
              <h2 className="text-xl font-semibold text-[#1F2937]">
                Review Summary
              </h2>

              {summaries.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {summaries.map(({ version, count, metrics, overall }) => (
                    <div key={version}>
                      <h3 className="mb-2 text-sm font-semibold">{version === 1 ? "Legacy ratings" : "Current ratings"} ({count} reviews)</h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {metrics.map(({ label, score }) => <SummaryPill key={label} label={label} score={score} />)}
                        <SummaryPill label="Overall" score={overall} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#6B7280]">
                  No published reviews yet.
                </p>
              )}
            </section>
          ) : null}
        </section>

        {canViewReviews ? (
          <section className="mt-6 rounded-2xl border border-[#E0E2E6] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#1F2937]">
              Student Reviews
            </h2>

            {faculty.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-[#6B7280]">
                No published reviews are available for this faculty member.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {faculty.reviews.map((review, index) => (
                  <article
                    key={`${review.faculty_id}-${index}`}
                    className="rounded-xl border border-[#E2E6EB] bg-[#FBFCFD] p-4"
                  >
                    <p className="text-sm font-semibold text-[#1F2937]">
                      {review.author_label}
                    </p>

                    <p className="mt-1 text-xs text-[#6B7280]">{review.rating_version === 1 ? "Legacy ratings" : "Current ratings"}</p>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {reviewMetrics(review).map(({ label, score }) => <Metric key={label} name={label} value={score} />)}
                    </div>

                    {review.description ? (
                      <p className="mt-3 text-sm text-[#4B5563]">
                        {review.description}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-[#E0E2E6] bg-[#FAFBFC] p-5">
            <h2 className="text-xl font-semibold text-[#1F2937]">
              Student Reviews
            </h2>
            <p className="mt-2 text-sm text-[#5B6472]">
              Sign in to view published student reviews and rating summaries.
            </p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Metric({ name, value }: { name: string; value: number }) {
  const tone = ratingTone(value);

  return (
    <div className={`rounded-lg border px-2 py-1 ${tone.bg} ${tone.border}`}>
      <p className="font-medium text-[#1F2937]">{name}</p>
      <p className={`text-sm ${tone.text}`}>{value}/10</p>
    </div>
  );
}

function SummaryPill({ label, score }: { label: string; score: number }) {
  const rounded = Number(score.toFixed(1));
  const tone = ratingTone(Math.round(rounded));

  return (
    <div className={`rounded-xl border px-3 py-2 ${tone.bg} ${tone.border}`}>
      <p className="text-xs font-medium text-[#1F2937]">{label}</p>
      <p className={`text-sm font-semibold ${tone.text}`}>
        {rounded.toFixed(1)} / 10
      </p>
    </div>
  );
}
