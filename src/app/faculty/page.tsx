
"use client";

import { useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/button";
import { DEPARTMENTS } from "@/lib/departments";
import {
  getFacultyDirectory,
  type FacultyWithReviews,
} from "@/lib/data/faculty";
import { createClient } from "@/lib/supabase/client";
import { summarizeFacultyReviews } from "@/lib/faculty-review-ratings";

export default function FacultyDirectoryPage() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [faculty, setFaculty] = useState<FacultyWithReviews[]>([]);
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
        const result = await getFacultyDirectory(supabase);

        if (!active) return;

        setFaculty(result.faculty);
        setCanViewReviews(result.canViewReviews);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the faculty directory.",
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
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return faculty.filter((item) => {
      const text = [
  item.name,
  item.department,
  item.summary_note ?? "",
]
  .join(" ")
  .toLowerCase();

      const matchesQuery = text.includes(normalizedQuery);
      const matchesDepartment =
        department === "all" || item.department === department;

      return matchesQuery && matchesDepartment;
    });
  }, [faculty, query, department]);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/"
          title="Supervisor Reviews"
          description="Explore faculty profiles and, when signed in, published student reviews."
        />

        <section className="mb-6 rounded-2xl border border-[#CBE2F5] bg-[#EEF7FE] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold text-[#1F2937]">
                Have you worked with a thesis supervisor?
              </h2>
              <p className="mt-1 text-sm text-[#425466]">
                Share your experience to help other students make more
                informed decisions.
              </p>
            </div>
            <LinkButton href="/faculty/post-review" variant="lightBlue">
              Post Your Review
            </LinkButton>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E0E2E6] bg-[#FAFBFC] p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm lg:col-span-2">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">
                Search
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="tc-input"
                placeholder="Search by faculty name, department, or summary"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">
                Department
              </span>
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className="tc-select"
              >
                <option value="all">All departments</option>
                {DEPARTMENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <section className="mt-6 rounded-2xl border border-[#E0E2E6] bg-white p-10 text-center">
            <p className="text-sm text-[#5B6472]">
              Loading faculty directory...
            </p>
          </section>
        ) : error ? (
          <section
            role="alert"
            className="mt-6 rounded-2xl border border-[#F6C5C1] bg-[#FDECEC] p-6"
          >
            <h2 className="font-semibold text-[#B42318]">
              Unable to load faculty
            </h2>
            <p className="mt-2 text-sm text-[#7F1D1D]">{error}</p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CBD2DC] bg-[#FBFCFD] p-10 text-center md:col-span-2">
                <h2 className="text-xl font-semibold text-[#1F2937]">
                  {faculty.length === 0
                    ? "No faculty profiles yet"
                    : "No faculty found"}
                </h2>
                <p className="mt-2 text-sm text-[#5B6472]">
                  {faculty.length === 0
                    ? "Approved faculty profiles will appear here."
                    : "Try changing your search or department filter."}
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const summaries = summarizeFacultyReviews(item.reviews);

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[#DCE0E6] bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-2xl font-semibold text-[#191C21]">
                        {item.name}
                      </h2>
                      <span className="rounded-full border border-[#D8DEE8] bg-[#F7F8FA] px-2.5 py-1 text-xs font-medium text-[#334155]">
                        {item.department}
                      </span>
                    </div>

                    {item.summary_note ? (
                      <section className="mt-3 rounded-xl border border-[#E3E7EE] bg-[#FAFBFC] p-3">
                        <h3 className="text-sm font-semibold text-[#1F2937]">
                          Profile Summary
                        </h3>
                        <p className="mt-1 text-sm text-[#4B5563]">
                          {item.summary_note}
                        </p>
                      </section>
                    ) : null}

                    {canViewReviews ? (
                      <div className="mt-3 space-y-1 text-sm text-[#374151]">
                        {summaries.length ? summaries.map(({ version, overall, count }) => (
                          <p key={version}>{version === 1 ? "Legacy rating" : "Current rating"}: {overall.toFixed(1)} / 10 ({count} reviews)</p>
                        )) : <p>No published reviews yet.</p>}
                      </div>
                    ) : null}

                    <LinkButton
                      href={`/faculty/${item.slug}`}
                      variant="lightBlue"
                      className="mt-4"
                    >
                      View Profile and Reviews
                    </LinkButton>
                  </article>
                );
              })
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
