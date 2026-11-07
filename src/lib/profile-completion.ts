import type { Profile, StudentPrivate } from "@/lib/data/profile";

export type StudentProfileDetails = {
  cgpa: number | null;
  currentSemester: string | null;
  bracLike: string | null;
};

export function isStudentProfileComplete(
  profile: Pick<Profile, "displayName" | "department"> | null,
  student: Pick<StudentPrivate, "studentId"> | null,
  details: StudentProfileDetails | null,
): boolean {
  if (!profile?.displayName.trim() || !profile.department || !student?.studentId.trim() || !details) return false;
  try { validateStudentProfileDetails(details); return true; }
  catch { return false; }
}

const cgpaError = "Enter a CGPA from 0.00 to 4.00 with up to two decimal places.";

function isValidCgpa(value: number | null): boolean {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 4
    && value === Math.round(value * 100) / 100;
}

export function parseProfileCgpa(input: string): number {
  const value = input.trim();
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value)) {
    throw new Error(cgpaError);
  }
  const cgpa = Number(value);
  if (!isValidCgpa(cgpa)) {
    throw new Error(cgpaError);
  }
  return cgpa;
}

export function validateStudentProfileDetails(details: StudentProfileDetails): void {
  if (!isValidCgpa(details.cgpa)) {
    throw new Error(cgpaError);
  }
  if (!details.currentSemester?.trim() || details.currentSemester.trim().length > 40) {
    throw new Error("Enter your current semester (up to 40 characters).");
  }
  if ((details.bracLike?.trim().length ?? 0) > 500) {
    throw new Error("Keep your BRAC University response to 500 characters or fewer.");
  }
}
