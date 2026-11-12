import { throwSafeDataError } from "./safe-errors";
import type { FacultyRatings, LegacyReviewScores, ReviewScores } from "@/lib/faculty-review-ratings";
import { requireBracUser } from "@/lib/auth/require-brac-user";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepartmentValue } from "@/lib/departments";

export type FacultyPublic = {
  id: string;
  slug: string;
  name: string;
  initials: string | null;
  department: DepartmentValue;
  summary_note: string | null;
  created_at: string;
};

export type FacultyReviewPublic = ReviewScores & {
  faculty_id: string;
  author_label: string;
  description: string;
};

export type FacultyWithReviews = FacultyPublic & {
  official_profile?: {
    designation?: string;
    email?: string;
    address?: string;
    roles?: string[];
    levels?: string[];
    types?: string[];
    research_interests?: string[];
  } | null;
  reviews: FacultyReviewPublic[];
};

export type FacultyDirectoryResult = {
  faculty: FacultyWithReviews[];
  canViewReviews: boolean;
};

export type FacultyProfileResult = {
  faculty: FacultyWithReviews | null;
  canViewReviews: boolean;
};

export type ReviewInput = FacultyRatings & {
  facultyId: string;
  description: string;
};

export type OwnFacultyReview = ReviewScores & {
  id: string;
  facultyId: string;
  description: string;
  moderationStatus: "published" | "hidden";
  createdAt: string;
  facultyName: string | null;
  facultySlug: string | null;
};

export type FacultyAddRequestInput = {
  proposedName: string;
  proposedDepartment: DepartmentValue;
  proposedResearchInterests: string[];
  rationale: string;
};

export type OwnFacultyAddRequest = FacultyAddRequestInput & {
  id: string;
  status: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

async function requireAuthenticatedUser(supabase: SupabaseClient) {
  return requireBracUser(supabase);
}

function throwIfError(error: { message: string; code?: string } | null) {
  if (error) throwSafeDataError(error);
}

const FACULTY_COLUMNS =
  "id, slug, name, initials, department, summary_note, created_at";

const RATING_COLUMNS =
  "rating_version, clarity, responsiveness, fairness, workload, marking, responsibility, connection, recommendation_letter";
const REVIEW_COLUMNS = `faculty_id, author_label, description, ${RATING_COLUMNS}`;

async function canCurrentUserViewReviews(supabase: SupabaseClient): Promise<boolean> {
  try { await requireBracUser(supabase); return true; }
  catch { return false; }
}

async function getPublishedReviews(
  supabase: SupabaseClient,
  facultyIds: string[],
): Promise<FacultyReviewPublic[]> {
  if (facultyIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("faculty_reviews_public")
    .select(REVIEW_COLUMNS)
    .in("faculty_id", facultyIds);

  // The directory can be deployed before the independent ratings-v2 migration.
  if (error?.code === "42703") {
    const legacy = await supabase
      .from("faculty_reviews_public")
      .select("faculty_id, author_label, description, clarity, responsiveness, fairness, workload")
      .in("faculty_id", facultyIds);
    if (legacy.error) throwSafeDataError(legacy.error);
    return (legacy.data ?? []).map((review) => ({ ...review, rating_version: 1 }));
  }

  if (error) {
    throwSafeDataError(error);
  }

  return (data ?? []) as FacultyReviewPublic[];
}

function attachReviews(
  faculty: FacultyPublic[],
  reviews: FacultyReviewPublic[],
): FacultyWithReviews[] {
  const reviewsByFaculty = new Map<string, FacultyReviewPublic[]>();

  for (const review of reviews) {
    const existing = reviewsByFaculty.get(review.faculty_id) ?? [];
    existing.push(review);
    reviewsByFaculty.set(review.faculty_id, existing);
  }

  return faculty.map((item) => ({
    ...item,
    reviews: reviewsByFaculty.get(item.id) ?? [],
  }));
}

export async function getFacultyDirectory(
  supabase: SupabaseClient,
): Promise<FacultyDirectoryResult> {
  const { data, error } = await supabase
    .from("faculty_public")
    .select(FACULTY_COLUMNS)
    .order("name", { ascending: true });

  if (error) {
    throwSafeDataError(error);
  }

  const faculty = (data ?? []) as FacultyPublic[];
  const canViewReviews = await canCurrentUserViewReviews(supabase);

  const reviews = canViewReviews
    ? await getPublishedReviews(
        supabase,
        faculty.map((item) => item.id),
      )
    : [];

  return {
    faculty: attachReviews(faculty, reviews),
    canViewReviews,
  };
}

export async function getFacultyBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<FacultyProfileResult> {
  const { data, error } = await supabase
    .from("faculty_public")
    .select(`${FACULTY_COLUMNS}, official_profile`)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throwSafeDataError(error);
  }

  if (!data) {
    return {
      faculty: null,
      canViewReviews: false,
    };
  }

  const faculty = data as FacultyPublic;
  const canViewReviews = await canCurrentUserViewReviews(supabase);

  const reviews = canViewReviews
    ? await getPublishedReviews(supabase, [faculty.id])
    : [];

  return {
    faculty: {
      ...faculty,
      reviews,
    },
    canViewReviews,
  };
}

export async function getOwnFacultyReviews(
  supabase: SupabaseClient,
): Promise<OwnFacultyReview[]> {
  const user = await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase
    .from("faculty_reviews")
    .select(`id, faculty_id, description, moderation_status, created_at, ${RATING_COLUMNS}`)
    .eq("reviewer_user_id", user.id)
    .order("created_at", { ascending: false });
  throwIfError(error);

  const rows = (data ?? []) as Array<ReviewScores & { id: string; faculty_id: string; description: string; moderation_status: OwnFacultyReview["moderationStatus"]; created_at: string }>;
  const facultyIds = rows.map((row) => String(row.faculty_id));
  const { data: facultyRows, error: facultyError } = facultyIds.length
    ? await supabase.from("faculty_public").select("id, name, slug").in("id", facultyIds)
    : { data: [], error: null };
  throwIfError(facultyError);
  const facultyById = new Map(
    ((facultyRows ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
  );

  return rows.map((row) => {
    const faculty = facultyById.get(String(row.faculty_id));
    return {
      ...row, facultyId: row.faculty_id, moderationStatus: row.moderation_status,
      createdAt: row.created_at, facultyName: faculty ? String(faculty.name) : null,
      facultySlug: faculty ? String(faculty.slug) : null,
    };
  });
}

export async function createOwnFacultyReview(supabase: SupabaseClient, input: ReviewInput): Promise<string> {
  await requireBracUser(supabase);
  const { data, error } = await supabase.rpc("create_own_faculty_review_v2", {
    p_faculty_id: input.facultyId, ...reviewRatingArgs(input),
  });
  throwIfError(error);
  if (typeof data !== "string") throw new Error("The review service returned an invalid identifier.");
  return data;
}

export async function updateOwnFacultyReview(supabase: SupabaseClient, reviewId: string, input: Omit<ReviewInput, "facultyId">): Promise<void> {
  await requireBracUser(supabase);
  const { error } = await supabase.rpc("update_own_faculty_review_v2", {
    p_review_id: reviewId, ...reviewRatingArgs(input),
  });
  throwIfError(error);
}

function reviewRatingArgs(input: Omit<ReviewInput, "facultyId">) {
  return {
    p_marking: input.marking, p_responsiveness: input.responsiveness,
    p_responsibility: input.responsibility, p_connection: input.connection,
    p_recommendation_letter: input.recommendation_letter, p_description: input.description,
  };
}

export async function updateOwnLegacyFacultyReview(supabase: SupabaseClient, reviewId: string, scores: LegacyReviewScores, description: string): Promise<void> {
  await requireBracUser(supabase);
  const { error } = await supabase.rpc("update_own_faculty_review", {
    p_review_id: reviewId, p_clarity: scores.clarity, p_responsiveness: scores.responsiveness,
    p_fairness: scores.fairness, p_workload: scores.workload, p_description: description,
  });
  throwIfError(error);
}

export async function deleteOwnFacultyReview(supabase: SupabaseClient, reviewId: string): Promise<void> {
  await requireBracUser(supabase);
  const { error } = await supabase.rpc("delete_own_faculty_review", { p_review_id: reviewId });
  throwIfError(error);
}

export async function submitFacultyAddRequest(supabase: SupabaseClient, input: FacultyAddRequestInput): Promise<string> {
  await requireBracUser(supabase);
  const { data, error } = await supabase.rpc("submit_faculty_add_request", {
    p_proposed_name: input.proposedName, p_proposed_department: input.proposedDepartment,
    p_proposed_research_interests: input.proposedResearchInterests, p_rationale: input.rationale,
  });
  throwIfError(error);
  if (typeof data !== "string") throw new Error("The request service returned an invalid identifier.");
  return data;
}

export async function getOwnFacultyAddRequests(supabase: SupabaseClient): Promise<OwnFacultyAddRequest[]> {
  const user = await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase
    .from("faculty_add_requests")
    .select("id, proposed_name, proposed_department, proposed_research_interests, rationale, status, decision_note, created_at, decided_at")
    .eq("requester_user_id", user.id).order("created_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), proposedName: String(row.proposed_name), proposedDepartment: row.proposed_department as DepartmentValue,
    proposedResearchInterests: (row.proposed_research_interests ?? []) as string[], rationale: String(row.rationale),
    status: row.status as OwnFacultyAddRequest["status"], decisionNote: row.decision_note as string | null,
    createdAt: String(row.created_at), decidedAt: row.decided_at as string | null,
  }));
}
