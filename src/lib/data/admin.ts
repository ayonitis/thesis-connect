import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { ReviewScores } from "@/lib/faculty-review-ratings";
import type { DepartmentValue } from "@/lib/departments";
import { throwSafeDataError } from "./safe-errors";

export type AdminDashboard = {
  facultyCount: number;
  faculty: Array<{ id: string; name: string; department: DepartmentValue; slug: string }>;
  pendingCount: number;
  reviewCount: number;
  requests: Array<{ id: string; proposed_name: string; proposed_department: string; rationale: string; status: string; decision_note: string | null }>;
  reviews: Array<ReviewScores & { id: string; faculty_name: string; description: string; moderation_status: "published" | "hidden" }>;
  accounts: Array<{ id: string; display_name: string | null; department: string | null; confirmed: boolean; brac_eligible: boolean; moderator: boolean; created_at: string }>;
  logs: Array<{ id: string; action: string; created_at: string }>;
};

export async function getAdminDashboard(supabase: SupabaseClient): Promise<AdminDashboard> {
  await requireAdmin(supabase);
  const [dashboard, directory] = await Promise.all([
    supabase.rpc("admin_dashboard"),
    supabase.from("faculty_public").select("id, name, department, slug").order("created_at", { ascending: false }).order("id"),
  ]);
  if (dashboard.error) throwSafeDataError(dashboard.error);
  if (directory.error) throwSafeDataError(directory.error);
  if (!dashboard.data) throw new Error("Administration data is unavailable.");
  const { facultyCount, pendingCount, reviewCount, requests, reviews, accounts, logs } =
    dashboard.data as Omit<AdminDashboard, "faculty">;
  return { facultyCount, faculty: directory.data ?? [], pendingCount, reviewCount, requests, reviews, accounts, logs };
}

export async function addFaculty(supabase: SupabaseClient, input: {
  name: string;
  department: string;
  designation: string;
  email: string;
  summaryNote: string;
}): Promise<void> {
  await requireAdmin(supabase);
  const { error } = await supabase.rpc("admin_add_faculty", {
    p_name: input.name.trim(),
    p_department: input.department,
    p_designation: input.designation.trim() || null,
    p_email: input.email.trim() || null,
    p_summary_note: input.summaryNote.trim() || null,
  });
  if (error?.code === "23505") throw new Error("A faculty member with this name already exists in that department.");
  if (error?.code === "22023") throw new Error("Check the name, department and optional fields.");
  if (error) throwSafeDataError(error);
}

export async function deleteFaculty(supabase: SupabaseClient, facultyId: string): Promise<void> {
  await requireAdmin(supabase);
  const { error } = await supabase.rpc("admin_delete_faculty", { p_faculty_id: facultyId });
  if (error?.code === "23503") {
    throw new Error("This faculty member cannot be deleted because reviews, approved requests, or other records reference them.");
  }
  if (error?.code === "P0002") throw new Error("This faculty member is no longer in the directory.");
  if (error) throwSafeDataError(error);
}

export async function decideFacultyAddRequest(supabase: SupabaseClient, requestId: string, decision: "approved" | "rejected") {
  await requireAdmin(supabase);
  const { error } = await supabase.rpc("decide_faculty_add_request", { p_request_id: requestId, p_decision: decision, p_decision_note: null });
  if (error) throwSafeDataError(error);
}

export async function moderateFacultyReview(supabase: SupabaseClient, reviewId: string, visibility: "published" | "hidden") {
  await requireAdmin(supabase);
  const { error } = await supabase.rpc("moderate_faculty_review", { p_review_id: reviewId, p_visibility: visibility });
  if (error) throwSafeDataError(error);
}
