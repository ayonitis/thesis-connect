"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DEPARTMENTS, type DepartmentValue } from "@/lib/departments";
import {
  getPublicPartnerRoomById,
  submitRoomApplication,
  type PublicPartnerRoom,
} from "@/lib/data/partner-rooms";
import { createClient } from "@/lib/supabase/client";

type JoinFormState = {
  cgpa: string;
  department: DepartmentValue | "";
  completedCredits: string;
  whyJoin: string;
  contactLink: string;
};

const initialState: JoinFormState = {
  cgpa: "",
  department: "",
  completedCredits: "",
  whyJoin: "",
  contactLink: "",
};

export default function JoinRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [room, setRoom] = useState<PublicPartnerRoom | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [form, setForm] = useState<JoinFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showContactWarning, setShowContactWarning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRoom = async () => {
      setIsLoadingRoom(true);
      setRoomError(null);

      try {
        const publicRoom = await getPublicPartnerRoomById(createClient(), roomId);
        if (cancelled) return;

        if (!publicRoom) {
          setRoomError("This room is no longer open or is unavailable.");
          return;
        }

        setRoom(publicRoom);
      } catch (error) {
        if (!cancelled) {
          setRoomError(
            error instanceof Error
              ? error.message
              : "Unable to verify this room. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingRoom(false);
      }
    };

    void loadRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const retryLoadRoom = async () => {
    setIsLoadingRoom(true);
    setRoomError(null);

    try {
      const publicRoom = await getPublicPartnerRoomById(createClient(), roomId);
      if (!publicRoom) {
        setRoomError("This room is no longer open or is unavailable.");
      } else {
        setRoom(publicRoom);
      }
    } catch (error) {
      setRoomError(
        error instanceof Error
          ? error.message
          : "Unable to verify this room. Please try again.",
      );
    } finally {
      setIsLoadingRoom(false);
    }
  };

  const isAtCapacity = useMemo(
    () =>
      room !== null &&
      room.memberCount >= room.additionalMembersNeeded + 1,
    [room],
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const cgpa = Number(form.cgpa);
    const completedCredits = Number(form.completedCredits);
    const whyJoinLength = form.whyJoin.trim().length;
    const contactLink = form.contactLink.trim();

    if (!form.cgpa.trim() || !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 4) {
      nextErrors.cgpa = "CGPA must be a number from 0 to 4.";
    }

    if (!form.department) nextErrors.department = "Department is required.";

    if (
      !form.completedCredits.trim() ||
      !Number.isInteger(completedCredits) ||
      completedCredits < 0 ||
      completedCredits > 1000
    ) {
      nextErrors.completedCredits =
        "Completed credits must be a whole number from 0 to 1000.";
    }

    if (whyJoinLength < 10 || whyJoinLength > 3000) {
      nextErrors.whyJoin = "Explain why you want to join in 10 to 3,000 characters.";
    }

    if (contactLink.length < 3 || contactLink.length > 2048) {
      nextErrors.contactLink = "Provide a contact link from 3 to 2,048 characters.";
      setShowContactWarning(true);
    } else {
      try {
        const parsed = new URL(contactLink);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          nextErrors.contactLink = "Please provide a valid web link starting with http or https.";
        }
      } catch {
        nextErrors.contactLink = "Please provide a reasonably well-formed contact link.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (isAtCapacity) {
      setSubmitError("This room no longer has space for additional members.");
      return;
    }

    if (!room || !validate() || isSubmitting || !form.department) return;

    setIsSubmitting(true);
    try {
      await submitRoomApplication(createClient(), {
        roomId: room.id,
        department: form.department,
        cgpa: Number(form.cgpa),
        completedCredits: Number(form.completedCredits),
        whyJoin: form.whyJoin.trim(),
        contactLink: form.contactLink.trim(),
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit your application. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref={`/partners/${roomId}`}
          title="Request to Join"
          description="Submit your application details. Contact information is required so the host can reach you."
        />

        {isLoadingRoom ? (
          <section className="rounded-2xl border border-[#E0E2E6] bg-white p-6 text-sm text-[#5B6472]" role="status">
            Verifying room availability…
          </section>
        ) : null}

        {roomError ? (
          <section className="rounded-2xl border border-[#F2C5C2] bg-[#FFF4F3] p-6 text-[#B42318]" role="alert">
            <h2 className="text-xl font-semibold">Unable to submit an application</h2>
            <p className="mt-2 text-sm">{roomError}</p>
            <div className="mt-4">
              <Button type="button" variant="secondary" onClick={() => void retryLoadRoom()}>
                Try again
              </Button>
            </div>
          </section>
        ) : null}

        {!isLoadingRoom && room && isAtCapacity ? (
          <section className="rounded-2xl border border-[#F1D7A7] bg-[#FFF9EC] p-6 text-[#7A4C00]" role="status">
            <h2 className="text-xl font-semibold">This room is full</h2>
            <p className="mt-2 text-sm">It no longer has space for additional members.</p>
          </section>
        ) : null}

        {!isLoadingRoom && room && !isAtCapacity && submitted ? (
          <section className="rounded-2xl border border-[#BFD9C1] bg-[#EFFAF0] p-6 text-[#204D25]" role="status">
            <h2 className="text-2xl font-semibold">Application submitted</h2>
            <p className="mt-2 text-sm">Your application was submitted successfully.</p>
          </section>
        ) : null}

        {!isLoadingRoom && room && !isAtCapacity && !submitted ? (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
            <p className="mb-4 text-sm text-[#5B6472]">Your name is taken from your authenticated profile when the application is submitted.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CGPA" required error={errors.cgpa}>
                <input className="tc-input" inputMode="decimal" value={form.cgpa} onChange={(event) => setForm((previous) => ({ ...previous, cgpa: event.target.value }))} />
              </Field>

              <Field label="Department" required error={errors.department}>
                <select className="tc-select" value={form.department} onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value as DepartmentValue }))}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((department) => <option key={department.value} value={department.value}>{department.label}</option>)}
                </select>
              </Field>

              <Field label="Completed credits" required error={errors.completedCredits}>
                <input className="tc-input" inputMode="numeric" value={form.completedCredits} onChange={(event) => setForm((previous) => ({ ...previous, completedCredits: event.target.value }))} />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Why do you want to join this room?" required error={errors.whyJoin}>
                  <textarea className="tc-textarea min-h-28" value={form.whyJoin} onChange={(event) => setForm((previous) => ({ ...previous, whyJoin: event.target.value }))} />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Account/contact link" required error={errors.contactLink} helper="Your contact information is visible only to the host after your application is accepted; it is not public.">
                  <input className="tc-input" value={form.contactLink} onChange={(event) => setForm((previous) => ({ ...previous, contactLink: event.target.value }))} placeholder="https://facebook.com/..., https://instagram.com/..., https://wa.me/..." />
                </Field>
              </div>
            </div>

            {submitError ? <p className="mt-4 rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]" role="alert">{submitError}</p> : null}
            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit Join Request"}</Button>
            </div>
          </form>
        ) : null}
      </main>

      {showContactWarning ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#191C21]">Contact link required</h2>
            <p className="mt-2 text-sm text-[#4B5563]">To request to join this room, you must provide a contact link so the host can reach you after acceptance.</p>
            <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setShowContactWarning(false)}>I understand</Button></div>
          </div>
        </div>
      ) : null}

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
