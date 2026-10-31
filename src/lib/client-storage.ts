"use client";

import type { FacultyReview } from "@/lib/types";

const REVIEWS_KEY = "thesis-connect.reviews";

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getPostedReviews(): Record<string, FacultyReview[]> {
  if (typeof window === "undefined") return {};
  return parseJson<Record<string, FacultyReview[]>>(window.localStorage.getItem(REVIEWS_KEY), {});
}

export function savePostedReview(slug: string, review: FacultyReview) {
  if (typeof window === "undefined") return;

  const existing = getPostedReviews();
  const current = existing[slug] ?? [];
  existing[slug] = [review, ...current];

  window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(existing));
}
