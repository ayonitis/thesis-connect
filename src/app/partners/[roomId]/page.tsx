"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import {
  getPublicPartnerRoomById,
  type PublicPartnerRoom,
} from "@/lib/data/partner-rooms";
import { createClient } from "@/lib/supabase/client";

export default function PartnerRoomDetailsPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [room, setRoom] = useState<PublicPartnerRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitialRoom() {
      try {
        const supabase = createClient();
        const publicRoom = await getPublicPartnerRoomById(supabase, roomId);

        if (!active) return;

        setRoom(publicRoom);
        setLoadError(null);
      } catch (error) {
        if (!active) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this partner room.",
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialRoom();

    return () => {
      active = false;
    };
  }, [roomId]);

  const retryLoadRoom = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      setRoom(await getPublicPartnerRoomById(createClient(), roomId));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load this partner room.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createdLabel = useMemo(() => {
    if (!room) return "";
    return new Date(room.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [room]);

  const availableAdditionalPlaces = room
    ? Math.max(
        room.additionalMembersNeeded - Math.max(room.memberCount - 1, 0),
        0,
      )
    : 0;

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/partners"
          title="Room Details"
          description="Review full host and teammate requirement information before requesting to join."
        />

        {isLoading ? (
          <section className="rounded-2xl border border-[#E0E2E6] bg-white p-10 text-center">
            <p className="text-sm text-[#5B6472]">Loading room details...</p>
          </section>
        ) : loadError ? (
          <section role="alert" className="rounded-2xl border border-[#F6C5C1] bg-[#FDECEC] p-6">
            <h2 className="text-xl font-semibold text-[#B42318]">Unable to load room</h2>
            <p className="mt-2 text-sm text-[#7F1D1D]">{loadError}</p>
            <Button type="button" variant="secondary" className="mt-4" onClick={() => void retryLoadRoom()}>
              Try again
            </Button>
            <LinkButton href="/partners" variant="secondary" className="mt-4">
              Return to directory
            </LinkButton>
          </section>
        ) : !room ? (
          <section className="rounded-2xl border border-dashed border-[#CBD2DC] bg-[#FBFCFD] p-10 text-center">
            <h2 className="text-xl font-semibold text-[#1F2937]">Room not found</h2>
            <p className="mt-2 text-sm text-[#5B6472]">This room does not exist or is no longer open for discovery.</p>
            <LinkButton href="/partners" variant="secondary" className="mt-4">
              Return to directory
            </LinkButton>
          </section>
        ) : (
          <article className="rounded-2xl border border-[#E0E2E6] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold leading-tight text-[#191C21]">{room.title}</h2>
              <span className="rounded-full border border-[#DDE2E9] bg-[#F7F8FA] px-3 py-1 text-xs font-semibold text-[#324053]">
                Posted {createdLabel}
              </span>
            </div>

            <p className="mt-4 text-[#485262]">{room.description}</p>

            <section className="mt-6 grid gap-4 rounded-xl border border-[#E2E6EB] bg-[#FAFBFC] p-4 sm:grid-cols-2">
              <Info label="Host name" value={room.hostDisplayName} />
              <Info label="Host department" value={room.hostDepartment} />
              <Info label="Host completed credits" value={String(room.hostCompletedCredits)} />
              {room.showHostCgpa && room.hostCgpa !== null ? <Info label="Host CGPA" value={room.hostCgpa.toFixed(2)} /> : null}
            </section>

            <section className="mt-6 rounded-xl border border-[#E2E6EB] bg-white p-4">
              <h3 className="text-xl font-semibold text-[#1F2937]">Teammate requirements</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
                <li>
                  <span className="font-medium text-[#1F2937]">Expected CGPA range:</span>{" "}
                  {room.expectedCgpaMin.toFixed(2)}–{room.expectedCgpaMax.toFixed(2)}
                </li>
                <li>
                  <span className="font-medium text-[#1F2937]">Expected department:</span> {room.expectedDepartment}
                </li>
                <li>
                  <span className="font-medium text-[#1F2937]">Minimum completed credits:</span>{" "}
                  {room.minCompletedCredits}
                </li>
                {room.additionalInfo ? (
                  <li>
                    <span className="font-medium text-[#1F2937]">Additional teammate information:</span>{" "}
                    {room.additionalInfo}
                  </li>
                ) : null}
              </ul>
            </section>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[#415063]">
                <p className="font-semibold">Available additional places: {availableAdditionalPlaces}</p>
                <p className="mt-1 text-xs text-[#5B6472]">{room.memberCount} current memberships, including the host.</p>
              </div>
              {availableAdditionalPlaces > 0 ? (
                <LinkButton href={`/partners/${room.id}/join`} variant="primary">
                  Request to Join
                </LinkButton>
              ) : (
                <p className="rounded-xl border border-[#F1D7A7] bg-[#FFF9EC] px-4 py-2 text-sm font-medium text-[#7A4C00]">
                  This room is full
                </p>
              )}
            </div>

            <p className="mt-4 text-xs text-[#6B7280]">Applicant contact details and membership identities are not displayed publicly.</p>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-[#4B5563]">
      <span className="font-medium text-[#1F2937]">{label}:</span> {value}
    </p>
  );
}
