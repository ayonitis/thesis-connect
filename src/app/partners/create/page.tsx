"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DEPARTMENTS, type DepartmentValue } from "@/lib/departments";
import {
  createPartnerRoom,
  type CreatePartnerRoomInput,
} from "@/lib/data/partner-rooms";
import { createClient } from "@/lib/supabase/client";

type FormState = {
  hostCompletedCredits: string;
  hostCgpa: string;
  showHostCgpa: boolean;
  title: string;
  description: string;
  expectedCgpaMin: string;
  expectedCgpaMax: string;
  criteriaDepartment: DepartmentValue | "";
  criteriaMinCredits: string;
  additionalRequirements: string;
  additionalMembersNeeded: string;
};

const initialForm: FormState = {
  hostCompletedCredits: "",
  hostCgpa: "",
  showHostCgpa: false,
  title: "",
  description: "",
  expectedCgpaMin: "",
  expectedCgpaMax: "",
  criteriaDepartment: "",
  criteriaMinCredits: "",
  additionalRequirements: "",
  additionalMembersNeeded: "1",
};

export default function CreateRoomPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<"edit" | "preview" | "published">("edit");
  const [isPublishing, setIsPublishing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsed = useMemo(() => numberParsers(form), [form]);
  const previewRoom = useMemo(() => toPreviewRoom(form, parsed), [form, parsed]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.hostCompletedCredits.trim()) {
      nextErrors.hostCompletedCredits = "Completed credits are required.";
    } else if (
      !Number.isInteger(parsed.hostCompletedCredits) ||
      parsed.hostCompletedCredits < 0 ||
      parsed.hostCompletedCredits > 1000
    ) {
      nextErrors.hostCompletedCredits =
        "Completed credits must be a whole number from 0 to 1000.";
    }

    if (form.showHostCgpa && !form.hostCgpa.trim()) {
      nextErrors.hostCgpa = "Enter your CGPA before choosing to display it.";
    } else if (
      form.hostCgpa.trim() &&
      (!Number.isFinite(parsed.hostCgpa) ||
        (parsed.hostCgpa ?? 0) < 0 ||
        (parsed.hostCgpa ?? 0) > 4)
    ) {
      nextErrors.hostCgpa = "Host CGPA must be a number from 0 to 4.";
    }

    const titleLength = form.title.trim().length;
    if (titleLength < 3 || titleLength > 200) {
      nextErrors.title = "Thesis topic or room title must be 3 to 200 characters.";
    }

    const descriptionLength = form.description.trim().length;
    if (descriptionLength < 10 || descriptionLength > 5000) {
      nextErrors.description = "Description must be 10 to 5,000 characters.";
    }

    if (
      !form.expectedCgpaMin.trim() ||
      !Number.isFinite(parsed.minCgpa) ||
      parsed.minCgpa < 0 ||
      parsed.minCgpa > 4
    ) {
      nextErrors.expectedCgpaMin = "Minimum expected CGPA must be a number from 0 to 4.";
    }

    if (
      !form.expectedCgpaMax.trim() ||
      !Number.isFinite(parsed.maxCgpa) ||
      parsed.maxCgpa < 0 ||
      parsed.maxCgpa > 4
    ) {
      nextErrors.expectedCgpaMax = "Maximum expected CGPA must be a number from 0 to 4.";
    } else if (Number.isFinite(parsed.minCgpa) && parsed.minCgpa > parsed.maxCgpa) {
      nextErrors.expectedCgpaMax =
        "Maximum expected CGPA must be greater than or equal to minimum expected CGPA.";
    }

    if (!form.criteriaDepartment) {
      nextErrors.criteriaDepartment = "Select one expected department.";
    }

    if (!form.criteriaMinCredits.trim()) {
      nextErrors.criteriaMinCredits = "Minimum completed credits requirement is required.";
    } else if (
      !Number.isInteger(parsed.minCredits) ||
      parsed.minCredits < 0 ||
      parsed.minCredits > 1000
    ) {
      nextErrors.criteriaMinCredits =
        "Minimum completed credits must be a whole number from 0 to 1000.";
    }

    if (!form.additionalMembersNeeded.trim()) {
      nextErrors.additionalMembersNeeded =
        "Please specify the number of additional students needed.";
    } else if (
      !Number.isInteger(parsed.additionalMembersNeeded) ||
      parsed.additionalMembersNeeded < 1 ||
      parsed.additionalMembersNeeded > 10
    ) {
      nextErrors.additionalMembersNeeded =
        "Additional students needed must be a whole number from 1 to 10.";
    }

    if (form.additionalRequirements.trim().length > 2000) {
      nextErrors.additionalRequirements =
        "Additional teammate information must be 2,000 characters or fewer.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goToPreview = () => {
    setSubmitError(null);
    if (validate()) setStage("preview");
  };

  const publishRoom = async () => {
    if (!previewRoom || isPublishing) return;

    setSubmitError(null);
    setIsPublishing(true);

    try {
      const roomId = await createPartnerRoom(createClient(), previewRoom);
      setStage("published");
      window.setTimeout(() => {
        router.push(`/partners/${roomId}`);
      }, 900);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to create the room. Please try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/partners"
          title="Create a Room"
          description="Publish your thesis room with clear teammate requirements. Your name and department are securely taken from your completed profile."
        />

        {stage === "published" ? (
          <section
            className="rounded-2xl border border-[#BFD9C1] bg-[#EFFAF0] p-6 text-[#204D25]"
            role="status"
          >
            <h2 className="text-2xl font-semibold">Room published!</h2>
            <p className="mt-2 text-sm">
              Your room was created successfully. Opening its details now.
            </p>
          </section>
        ) : null}

        {stage === "edit" ? (
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              goToPreview();
            }}
          >
            <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
              <h2 className="text-2xl font-semibold">1) Host academic information</h2>
              <p className="mt-1 text-sm text-[#5B6472]">
                Your host name and department are retrieved from your authenticated profile when the room is published.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Completed credits" required error={errors.hostCompletedCredits}>
                  <input
                    className="tc-input"
                    inputMode="numeric"
                    value={form.hostCompletedCredits}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        hostCompletedCredits: event.target.value,
                      }))
                    }
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="CGPA (optional)" error={errors.hostCgpa}>
                    <input
                      className="tc-input"
                      inputMode="decimal"
                      value={form.hostCgpa}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, hostCgpa: event.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </Field>
                  <label className="mt-3 inline-flex items-center gap-2 text-sm text-[#334155]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[#C4CCD8]"
                      checked={form.showHostCgpa}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          showHostCgpa: event.target.checked,
                        }))
                      }
                      disabled={!form.hostCgpa.trim()}
                    />
                    Display my CGPA publicly
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
              <h2 className="text-2xl font-semibold">2) Thesis information</h2>
              <div className="mt-4 space-y-4">
                <Field label="Thesis topic or room title" required error={errors.title}>
                  <input
                    className="tc-input"
                    value={form.title}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, title: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Description of the proposed thesis" required error={errors.description}>
                  <textarea
                    className="tc-textarea min-h-32"
                    value={form.description}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, description: event.target.value }))
                    }
                    placeholder="Describe the problem, intended direction, and scope."
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
              <h2 className="text-2xl font-semibold">3) What the host is looking for</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Minimum expected CGPA" required error={errors.expectedCgpaMin}>
                  <input className="tc-input" inputMode="decimal" value={form.expectedCgpaMin} onChange={(event) => setForm((previous) => ({ ...previous, expectedCgpaMin: event.target.value }))} placeholder="e.g. 3.50" />
                </Field>
                <Field label="Maximum expected CGPA" required error={errors.expectedCgpaMax}>
                  <input className="tc-input" inputMode="decimal" value={form.expectedCgpaMax} onChange={(event) => setForm((previous) => ({ ...previous, expectedCgpaMax: event.target.value }))} placeholder="e.g. 3.80" />
                </Field>
                <Field label="Expected department" required error={errors.criteriaDepartment}>
                  <select className="tc-select" value={form.criteriaDepartment} onChange={(event) => setForm((previous) => ({ ...previous, criteriaDepartment: event.target.value as DepartmentValue }))}>
                    <option value="">Select one department</option>
                    {DEPARTMENTS.map((department) => (
                      <option key={department.value} value={department.value}>{department.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Minimum completed credits" required error={errors.criteriaMinCredits}>
                  <input className="tc-input" inputMode="numeric" value={form.criteriaMinCredits} onChange={(event) => setForm((previous) => ({ ...previous, criteriaMinCredits: event.target.value }))} />
                </Field>
                <Field label="Additional members needed" required error={errors.additionalMembersNeeded}>
                  <input className="tc-input" inputMode="numeric" value={form.additionalMembersNeeded} onChange={(event) => setForm((previous) => ({ ...previous, additionalMembersNeeded: event.target.value }))} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Additional teammate information (optional)" helper="Use this for relevant skills, coursework, preferred collaboration style, or context courses such as CSE422/CSE425." error={errors.additionalRequirements}>
                    <textarea className="tc-textarea min-h-28" value={form.additionalRequirements} onChange={(event) => setForm((previous) => ({ ...previous, additionalRequirements: event.target.value }))} />
                  </Field>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/partners")}>Cancel</Button>
              <Button type="submit">Preview Room</Button>
            </div>
          </form>
        ) : null}

        {stage === "preview" && previewRoom ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-[#E0E2E6] bg-[#F9FBFD] p-5">
              <h2 className="text-2xl font-semibold">Preview: Room card snapshot</h2>
              <p className="mt-1 text-sm text-[#5B6472]">
                Your completed profile supplies the host name and department when this room is published.
              </p>
              <div className="mt-4 rounded-xl border border-[#DCE0E6] bg-white p-4">
                <p className="text-xl font-semibold">{previewRoom.title}</p>
                <p className="mt-1 text-sm text-[#4B5563]">Completed credits: {previewRoom.hostCompletedCredits}</p>
                {previewRoom.showHostCgpa && previewRoom.hostCgpa !== null ? <p className="mt-1 text-sm text-[#4B5563]">Host CGPA: {previewRoom.hostCgpa.toFixed(2)}</p> : null}
                <p className="mt-2 text-sm text-[#4B5563]">Looking for {previewRoom.additionalMembersNeeded} members</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
              <h2 className="text-2xl font-semibold">Preview: Room details</h2>
              <div className="mt-3 space-y-2 text-sm text-[#374151]">
                <p>{previewRoom.description}</p>
                <p><span className="font-medium">Expected CGPA range:</span> {previewRoom.expectedCgpaMin.toFixed(2)}–{previewRoom.expectedCgpaMax.toFixed(2)}</p>
                <p><span className="font-medium">Expected department:</span> {previewRoom.expectedDepartment}</p>
                <p><span className="font-medium">Minimum completed credits:</span> {previewRoom.minCompletedCredits}</p>
                {previewRoom.additionalInfo ? <p><span className="font-medium">Additional teammate information:</span> {previewRoom.additionalInfo}</p> : null}
              </div>
            </div>

            {submitError ? <p className="rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]" role="alert">{submitError}</p> : null}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setStage("edit")} disabled={isPublishing}>Back</Button>
              <Button variant="ghost" onClick={() => router.push("/partners")} disabled={isPublishing}>Cancel</Button>
              <Button onClick={publishRoom} disabled={isPublishing}>{isPublishing ? "Publishing…" : "Publish Room"}</Button>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, required, helper, error, children }: { label: string; required?: boolean; helper?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-[#2F3A4A]">{label}{required ? " *" : ""}</span>
      {children}
      {helper ? <p className="mt-1 text-xs text-[#64748B]">{helper}</p> : null}
      {error ? <p className="mt-1 text-xs text-[#B42318]">{error}</p> : null}
    </label>
  );
}

function numberParsers(form: FormState) {
  return {
    minCgpa: Number(form.expectedCgpaMin),
    maxCgpa: Number(form.expectedCgpaMax),
    hostCgpa: form.hostCgpa.trim() ? Number(form.hostCgpa) : null,
    hostCompletedCredits: Number(form.hostCompletedCredits),
    minCredits: Number(form.criteriaMinCredits),
    additionalMembersNeeded: Number(form.additionalMembersNeeded),
  };
}

function toPreviewRoom(form: FormState, parsed: ReturnType<typeof numberParsers>): CreatePartnerRoomInput | null {
  if (!form.criteriaDepartment || !form.title.trim() || !form.description.trim()) return null;
  if (!Number.isFinite(parsed.minCgpa) || !Number.isFinite(parsed.maxCgpa) || parsed.minCgpa > parsed.maxCgpa) return null;
  if (!Number.isInteger(parsed.hostCompletedCredits) || !Number.isInteger(parsed.minCredits) || !Number.isInteger(parsed.additionalMembersNeeded)) return null;
  if (parsed.hostCgpa !== null && !Number.isFinite(parsed.hostCgpa)) return null;

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    hostCompletedCredits: parsed.hostCompletedCredits,
    hostCgpa: parsed.hostCgpa,
    showHostCgpa: form.showHostCgpa,
    additionalMembersNeeded: parsed.additionalMembersNeeded,
    expectedDepartment: form.criteriaDepartment,
    expectedCgpaMin: parsed.minCgpa,
    expectedCgpaMax: parsed.maxCgpa,
    minCompletedCredits: parsed.minCredits,
    additionalInfo: form.additionalRequirements.trim() || null,
  };
}
