
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

export type FacultyReviewPublic = {
  faculty_id: string;
  author_label: string;
  clarity: number;
  responsiveness: number;
  fairness: number;
  workload: number;
  description: string;
};

export type FacultyWithReviews = FacultyPublic & {
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

export type ReviewInput = {
  facultyId: string;
  clarity: number;
  responsiveness: number;
  fairness: number;
  workload: number;
  description: string;
};

export type OwnFacultyReview = ReviewInput & {
  id: string;
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

export type AdminFacultyRequest = OwnFacultyAddRequest & {
  requesterUserId: string;
};

export type AdminFacultyReview = Omit<OwnFacultyReview, "facultyName" | "facultySlug"> & {
  reviewerUserId: string;
  facultyName: string | null;
};

export type ModerationLogEntry = {
  id: string;
  action: string;
  targetTable: string;
  targetId: string;
  createdAt: string;
};

async function requireAuthenticatedUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in to continue.");
  return user;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const FACULTY_COLUMNS =
  "id, slug, name, initials, department, summary_note, created_at";

const REVIEW_COLUMNS =
  "faculty_id, author_label, clarity, responsiveness, fairness, workload, description";

async function canCurrentUserViewReviews(
  supabase: SupabaseClient,
): Promise<boolean> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Fail closed: never query the protected reviews view if auth
  // cannot establish a signed-in user.
  return !error && Boolean(user);
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

  if (error) {
    throw new Error(error.message);
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
    throw new Error(error.message);
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
    .select(FACULTY_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
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
    .select("id, faculty_id, clarity, responsiveness, fairness, workload, description, moderation_status, created_at")
    .eq("reviewer_user_id", user.id)
    .order("created_at", { ascending: false });
  throwIfError(error);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
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
      id: String(row.id), facultyId: String(row.faculty_id), clarity: Number(row.clarity),
      responsiveness: Number(row.responsiveness), fairness: Number(row.fairness), workload: Number(row.workload),
      description: String(row.description), moderationStatus: row.moderation_status as "published" | "hidden",
      createdAt: String(row.created_at), facultyName: faculty ? String(faculty.name) : null,
      facultySlug: faculty ? String(faculty.slug) : null,
    };
  });
}

export async function createOwnFacultyReview(supabase: SupabaseClient, input: ReviewInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_own_faculty_review", {
    p_faculty_id: input.facultyId, p_clarity: input.clarity, p_responsiveness: input.responsiveness,
    p_fairness: input.fairness, p_workload: input.workload, p_description: input.description,
  });
  throwIfError(error);
  if (typeof data !== "string") throw new Error("The review service returned an invalid identifier.");
  return data;
}

export async function updateOwnFacultyReview(supabase: SupabaseClient, reviewId: string, input: Omit<ReviewInput, "facultyId">): Promise<void> {
  const { error } = await supabase.rpc("update_own_faculty_review", {
    p_review_id: reviewId, p_clarity: input.clarity, p_responsiveness: input.responsiveness,
    p_fairness: input.fairness, p_workload: input.workload, p_description: input.description,
  });
  throwIfError(error);
}

export async function submitFacultyAddRequest(supabase: SupabaseClient, input: FacultyAddRequestInput): Promise<string> {
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

export async function isCurrentUserAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  throwIfError(error);
  return data === true;
}

export async function getAdminFacultyData(supabase: SupabaseClient) {
  if (!(await isCurrentUserAdmin(supabase))) throw new Error("Administrator access is required.");
  const [requests, reviews, faculty, logs] = await Promise.all([
    supabase.from("faculty_add_requests").select("id, requester_user_id, proposed_name, proposed_department, proposed_research_interests, rationale, status, decision_note, created_at, decided_at").order("created_at", { ascending: false }),
    supabase.from("faculty_reviews").select("id, faculty_id, reviewer_user_id, clarity, responsiveness, fairness, workload, description, moderation_status, created_at").order("created_at", { ascending: false }),
    supabase.from("faculty").select("id, name"),
    supabase.from("moderation_log").select("id, action, target_table, target_id, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  throwIfError(requests.error); throwIfError(reviews.error); throwIfError(faculty.error); throwIfError(logs.error);
  const names = new Map(((faculty.data ?? []) as Array<Record<string, unknown>>).map((item) => [String(item.id), String(item.name)]));
  return {
    requests: ((requests.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), requesterUserId: String(row.requester_user_id), proposedName: String(row.proposed_name), proposedDepartment: row.proposed_department as DepartmentValue,
      proposedResearchInterests: (row.proposed_research_interests ?? []) as string[], rationale: String(row.rationale), status: row.status as OwnFacultyAddRequest["status"],
      decisionNote: row.decision_note as string | null, createdAt: String(row.created_at), decidedAt: row.decided_at as string | null,
    } satisfies AdminFacultyRequest)),
    reviews: ((reviews.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), facultyId: String(row.faculty_id), reviewerUserId: String(row.reviewer_user_id), clarity: Number(row.clarity), responsiveness: Number(row.responsiveness), fairness: Number(row.fairness), workload: Number(row.workload), description: String(row.description), moderationStatus: row.moderation_status as "published" | "hidden", createdAt: String(row.created_at), facultyName: names.get(String(row.faculty_id)) ?? null,
    } satisfies AdminFacultyReview)),
    facultyCount: (faculty.data ?? []).length,
    logs: ((logs.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), action: String(row.action), targetTable: String(row.target_table), targetId: String(row.target_id), createdAt: String(row.created_at) } satisfies ModerationLogEntry)),
  };
}

export async function decideFacultyAddRequest(supabase: SupabaseClient, requestId: string, decision: "approved" | "rejected", note: string): Promise<void> {
  const { error } = await supabase.rpc("decide_faculty_add_request", { p_request_id: requestId, p_decision: decision, p_decision_note: note || null });
  throwIfError(error);
}

export async function moderateFacultyReview(supabase: SupabaseClient, reviewId: string, visibility: "published" | "hidden"): Promise<void> {
  const { error } = await supabase.rpc("moderate_faculty_review", { p_review_id: reviewId, p_visibility: visibility });
  throwIfError(error);
}
