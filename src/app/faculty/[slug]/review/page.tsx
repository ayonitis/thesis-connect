
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createOwnFacultyReview, deleteOwnFacultyReview, getFacultyBySlug, getOwnFacultyReviews, updateOwnFacultyReview, type FacultyWithReviews } from "@/lib/data/faculty";
import { createClient } from "@/lib/supabase/client";
import { ratingTone } from "@/lib/review-utils";

type RatingField = "clarity" | "responsiveness" | "fairness" | "workload";

export default function PostReviewPage() {
  const params = useParams<{ slug: string }>();
  return <FacultyReviewForm key={params.slug} slug={params.slug} />;
}

function FacultyReviewForm({ slug }: { slug: string }) {
  const router = useRouter();

  const [faculty, setFaculty] = useState<FacultyWithReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [ratings, setRatings] = useState<Record<RatingField, number | null>>({
    clarity: null,
    responsiveness: null,
    fairness: null,
    workload: null,
  });

  const [description, setDescription] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFaculty() {
      try {
        const supabase = createClient();
        const [result, ownReviews] = await Promise.all([
          getFacultyBySlug(supabase, slug),
          getOwnFacultyReviews(supabase),
        ]);

        if (active) {
          setFaculty(result.faculty);
          const existing = result.faculty
            ? ownReviews.find((review) => review.facultyId === result.faculty?.id)
            : undefined;
          if (existing) {
            setReviewId(existing.id);
            setRatings({ clarity: existing.clarity, responsiveness: existing.responsiveness, fairness: existing.fairness, workload: existing.workload });
            setDescription(existing.description);
          }
          setLoadError("");
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load this faculty profile.",
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
  }, [slug]);

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!faculty || saving) return;
    if (Object.values(ratings).some((value) => value === null) || description.trim().length < 10 || description.trim().length > 5000) {
      setSaveError("Choose all four ratings and provide a description between 10 and 5,000 characters.");
      return;
    }
    setSaving(true); setSaveError(""); setNotice("");
    const input = { clarity: ratings.clarity!, responsiveness: ratings.responsiveness!, fairness: ratings.fairness!, workload: ratings.workload!, description };
    try {
      if (reviewId) await updateOwnFacultyReview(createClient(), reviewId, input);
      else setReviewId(await createOwnFacultyReview(createClient(), { facultyId: faculty.id, ...input }));
      setNotice(reviewId ? "Your review was updated." : "Your review was submitted.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save your review.");
    } finally { setSaving(false); }
  };

  const deleteReview = async () => {
    if (!reviewId || saving) return;
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setSaving(true); setSaveError(""); setNotice("");
    try {
      await deleteOwnFacultyReview(createClient(), reviewId);
      setReviewId(null);
      setRatings({ clarity: null, responsiveness: null, fairness: null, workload: null });
      setDescription("");
      setNotice("Your review was deleted.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to delete your review. Please try again.");
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader fallbackHref="/faculty" title="Post a Review" />
          <p className="mt-6 text-sm text-[#64748B]">
            Loading faculty profile...
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadError || !faculty) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            fallbackHref="/faculty"
            title={loadError ? "Unable to Load Faculty" : "Faculty Not Found"}
          />
          <p className="mt-4 text-sm text-[#B42318]">
            {loadError || "This faculty member could not be found."}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref={`/faculty/${slug}`}
          title={reviewId ? "Edit Your Review" : "Post a Review"}
          description="Share respectful feedback without including personal information."
        />
        {notice ? <p role="status" className="mb-5 rounded-xl border border-[#BFD9C1] bg-[#EFFAF0] p-4 text-sm text-[#204D25]">{notice}</p> : null}
        {saveError ? <p role="alert" className="mb-5 rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]">{saveError}</p> : null}

        <section className="mb-4 rounded-xl border border-[#E2E6EB] bg-[#FAFBFC] px-4 py-3 text-sm text-[#374151]">
          <p>
            Supervisor:{" "}
            <span className="font-semibold text-[#1F2937]">
              {faculty.name}
            </span>
          </p>
          <p className="mt-1">
            Department: {faculty.department}
          </p>
          {faculty.initials ? (
            <p className="mt-1">
              Faculty initials:{" "}
              <span className="font-semibold text-[#1F2937]">
                {faculty.initials}
              </span>
            </p>
          ) : null}
        </section>

        <form
          onSubmit={submitReview}
          className="rounded-2xl border border-[#E0E2E6] bg-white p-5"
        >
          <div className="space-y-4">
            <RatingPicker
              label="Clarity rating"
              value={ratings.clarity}
              onChange={(value) =>
                setRatings((prev) => ({ ...prev, clarity: value }))
              }
            />

            <RatingPicker
              label="Responsiveness rating"
              value={ratings.responsiveness}
              onChange={(value) =>
                setRatings((prev) => ({ ...prev, responsiveness: value }))
              }
            />

            <RatingPicker
              label="Fairness rating"
              value={ratings.fairness}
              onChange={(value) =>
                setRatings((prev) => ({ ...prev, fairness: value }))
              }
            />

            <RatingPicker
              label="Workload rating"
              value={ratings.workload}
              onChange={(value) =>
                setRatings((prev) => ({ ...prev, workload: value }))
              }
            />

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">
                Additional Description
              </span>
              <textarea
                required
                minLength={10}
                maxLength={5000}
                className="tc-textarea min-h-28"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Share specific, respectful feedback that reflects your supervision experience."
              />
              <p className="mt-1 text-xs text-[#64748B]">
                Include constructive details about supervision experience and
                avoid disclosing private information.
              </p>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            {reviewId ? <Button type="button" variant="secondary" disabled={saving} onClick={deleteReview}>Delete My Review</Button> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : reviewId ? "Save Changes" : "Submit Review"}
            </Button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}

function RatingPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[#2F3A4A]">
        {label}
      </legend>

      <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }).map((_, index) => {
          const score = index + 1;
          const tone = ratingTone(score);
          const selected = value === score;

          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition ${tone.bg} ${tone.border} ${tone.text} ${
                selected
                  ? "ring-2 ring-[#2459A9] ring-offset-1"
                  : "hover:opacity-85"
              }`}
              aria-pressed={selected}
              aria-label={`${label} ${score} out of 10`}
            >
              {score}
            </button>
          );
        })}
      </div>

      {value !== null ? (
        <p className="mt-1 text-xs text-[#475467]">
          Selected: {value}/10
        </p>
      ) : null}
    </fieldset>
  );
}
