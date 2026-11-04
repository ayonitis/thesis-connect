import { throwSafeDataError } from "./safe-errors";
import { requireBracUser } from "@/lib/auth/require-brac-user";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepartmentValue } from "@/lib/departments";

export type Profile = {
  userId: string;
  displayName: string;
  department: DepartmentValue | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentPrivate = {
  userId: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileUpdate = {
  displayName?: string;
  department?: DepartmentValue;
};

function toProfile(row: {
  user_id: string;
  display_name: string;
  department: DepartmentValue | null;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    department: row.department,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStudentPrivate(row: {
  user_id: string;
  student_id: string;
  created_at: string;
  updated_at: string;
}): StudentPrivate {
  return {
    userId: row.user_id,
    studentId: row.student_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCurrentUserId(supabase: SupabaseClient): Promise<string> {
  return (await requireBracUser(supabase)).id;
}

export async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const userId = await getCurrentUserId(supabase);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, department, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throwSafeDataError(error);
  }

  return data ? toProfile(data as Parameters<typeof toProfile>[0]) : null;
}

export async function updateCurrentProfile(supabase: SupabaseClient, update: ProfileUpdate): Promise<Profile> {
  const userId = await getCurrentUserId(supabase);
  const values: { display_name?: string; department?: DepartmentValue } = {};

  if (update.displayName !== undefined) {
    const displayName = update.displayName.trim();
    if (displayName.length < 1 || displayName.length > 100) {
      throw new Error("Display name must contain between 1 and 100 characters.");
    }
    values.display_name = displayName;
  }

  if (update.department !== undefined) {
    values.department = update.department;
  }

  if (Object.keys(values).length === 0) {
    throw new Error("No profile changes were provided.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(values)
    .eq("user_id", userId)
    .select("user_id, display_name, department, created_at, updated_at")
    .single();

  if (error) {
    throwSafeDataError(error);
  }

  return toProfile(data as Parameters<typeof toProfile>[0]);
}

export async function updateCurrentDisplayName(supabase: SupabaseClient, displayName: string): Promise<Profile> {
  await requireBracUser(supabase);
  return updateCurrentProfile(supabase, { displayName });
}

export async function updateCurrentDepartment(supabase: SupabaseClient, department: DepartmentValue): Promise<Profile> {
  await requireBracUser(supabase);
  return updateCurrentProfile(supabase, { department });
}

export async function getCurrentStudentPrivate(supabase: SupabaseClient): Promise<StudentPrivate | null> {
  const userId = await getCurrentUserId(supabase);
  const { data, error } = await supabase
    .from("student_private")
    .select("user_id, student_id, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throwSafeDataError(error);
  }

  return data ? toStudentPrivate(data as Parameters<typeof toStudentPrivate>[0]) : null;
}

export async function updateCurrentStudentPrivate(supabase: SupabaseClient, studentIdInput: string): Promise<StudentPrivate> {
  const userId = await getCurrentUserId(supabase);
  const studentId = studentIdInput.trim();

  if (studentId.length < 1 || studentId.length > 64) {
    throw new Error("Student ID must contain between 1 and 64 characters.");
  }

  const existing = await getCurrentStudentPrivate(supabase);
  const query = existing
    ? supabase.from("student_private").update({ student_id: studentId }).eq("user_id", userId)
    : supabase.from("student_private").insert({ user_id: userId, student_id: studentId });
  const { data, error } = await query.select("user_id, student_id, created_at, updated_at").single();

  if (error) {
    throwSafeDataError(error);
  }

  return toStudentPrivate(data as Parameters<typeof toStudentPrivate>[0]);
}
