import { average } from "@/lib/review-utils";

export const FACULTY_REVIEW_RATINGS = [
  ["marking", "Marking"],
  ["responsiveness", "Responsiveness"],
  ["responsibility", "Responsibility"],
  ["connection", "Connection"],
  ["recommendation_letter", "Recommendation Letter"],
] as const;

const LEGACY_RATINGS = [
  ["clarity", "Clarity"],
  ["responsiveness", "Responsiveness"],
  ["fairness", "Fairness"],
  ["workload", "Workload"],
] as const;

export type FacultyRatingKey = (typeof FACULTY_REVIEW_RATINGS)[number][0];
export type FacultyRatings = Record<FacultyRatingKey, number>;
export type LegacyReviewScores = Record<(typeof LEGACY_RATINGS)[number][0], number> & { rating_version: 1 };
export type ReviewScores = LegacyReviewScores | (FacultyRatings & { rating_version: 2 });

export function hasCompleteFacultyRatings(ratings: Record<FacultyRatingKey, number | null>): ratings is FacultyRatings {
  return FACULTY_REVIEW_RATINGS.every(([key]) => {
    const value = ratings[key];
    return value !== null && Number.isInteger(value) && value >= 1 && value <= 10;
  });
}

export function reviewMetrics(review: ReviewScores) {
  return review.rating_version === 1
    ? LEGACY_RATINGS.map(([key, label]) => ({ label, score: review[key] }))
    : FACULTY_REVIEW_RATINGS.map(([key, label]) => ({ label, score: review[key] }));
}

export function summarizeFacultyReviews(reviews: ReviewScores[]) {
  return ([2, 1] as const).flatMap((version) => {
    const group = reviews.filter((review) => review.rating_version === version);
    if (!group.length) return [];
    const rows = group.map(reviewMetrics);
    const metrics = rows[0].map(({ label }, index) => ({
      label,
      score: average(rows.map((row) => row[index].score)),
    }));
    return { version, count: group.length, metrics, overall: average(metrics.map(({ score }) => score)) };
  });
}
