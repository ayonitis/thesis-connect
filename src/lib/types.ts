import type { DepartmentValue } from "@/lib/departments";

export type FacultyReview = {
  id: string;
  reviewerLabel: string;
  clarity: number;
  responsiveness: number;
  fairness: number;
  workload: number;
  description: string;
  createdAt: string;
  isMock: boolean;
};

export type FacultyRecord = {
  slug: string;
  name: string;
  initials: string;
  department: DepartmentValue;
  researchInterests: string[];
  summaryNote: string;
  reviews: FacultyReview[];
  isMock: boolean;
};
