"use client";

import { useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerRoomCard } from "@/components/partners/partner-room-card";
import { Button, LinkButton } from "@/components/ui/button";
import {
  listPublicPartnerRooms,
  type RoomApplicationStatus,
  type PublicPartnerRoom,
} from "@/lib/data/partner-rooms";
import { DEPARTMENTS } from "@/lib/departments";
import { createClient } from "@/lib/supabase/client";

function sortNewest(a: PublicPartnerRoom, b: PublicPartnerRoom) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function sortOldest(a: PublicPartnerRoom, b: PublicPartnerRoom) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export default function PartnerDirectoryPage() {
  const [query, setQuery] = useState("");
  const [cgpaThreshold, setCgpaThreshold] = useState("");
  const [department, setDepartment] = useState("all");
  const [sorting, setSorting] = useState<"newest" | "oldest">("newest");
  const [viewer, setViewer] = useState<{ hosted: string[]; statuses: Partial<Record<string, RoomApplicationStatus>> } | null>(null);
  const [rooms, setRooms] = useState<PublicPartnerRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    let generation = 0;

    async function loadInitialRooms() {
      const request = ++generation;
      try {
        const supabase = createClient();
        const publicRooms = await listPublicPartnerRooms(supabase);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        let viewerData: typeof viewer = authError && authError.name !== "AuthSessionMissingError"
          ? null : { hosted: [], statuses: {} };
        if (user && !authError && viewerData) {
          // Scope both lookups to the displayed rooms so unrelated history cannot
          // consume the API row limit. Each room has at most one row per lookup.
          for (let start = 0; start < publicRooms.length; start += 100) {
            const ids = publicRooms.slice(start, start + 100).map(({ id }) => id);
            const [hosted, applications] = await Promise.all([
              supabase.from("partner_rooms").select("id").eq("host_user_id", user.id).in("id", ids),
              supabase.from("room_join_applications").select("room_id,status").eq("applicant_user_id", user.id).in("room_id", ids),
            ]);
            if (hosted.error || applications.error) {
              viewerData = null;
              break;
            }
            viewerData.hosted.push(...hosted.data.map(({ id }) => id));
            for (const { room_id, status } of applications.data) {
              viewerData.statuses[room_id] = status;
            }
          }
        }
        if (!active || request !== generation) return;
        setViewer(viewerData);

        setRooms(publicRooms);
        setLoadError(null);
      } catch (error) {
        if (!active || request !== generation) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load partner rooms.",
        );
      } finally {
        if (active && request === generation) {
          setIsLoading(false);
        }
      }
    }

    const refreshRooms = () => { void loadInitialRooms(); };
    refreshRooms();
    window.addEventListener("focus", refreshRooms);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshRooms);
    };
  }, [reload]);

  function retryLoadRooms() {
    setIsLoading(true);
    setLoadError(null);
    setReload((current) => current + 1);
  }

  const filtered = useMemo(() => {
    const threshold = Number(cgpaThreshold);

    const matched = rooms.filter((room) => {
      const text = `${room.title} ${room.description} ${room.hostDisplayName}`.toLowerCase();
      const matchesSearch = text.includes(query.trim().toLowerCase());
      const matchesDepartment = department === "all" || room.hostDepartment === department;

      const matchesCgpa =
        !cgpaThreshold ||
        (Number.isFinite(threshold) && threshold > 0
          ? room.expectedCgpaMin >= threshold
          : true);

      return matchesSearch && matchesDepartment && matchesCgpa;
    });

    return matched.sort(sorting === "newest" ? sortNewest : sortOldest);
  }, [rooms, query, department, cgpaThreshold, sorting]);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/"
          title="Partner Room Directory"
          description="Discover thesis rooms, review host expectations, and request to join a team that matches your preparation."
          rightSlot={
            <LinkButton href="/partners/create" variant="lightBlue">
              Create a room
            </LinkButton>
          }
        />

        <section className="rounded-2xl border border-[#E0E2E6] bg-[#FAFBFC] p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="tc-input"
                placeholder="Search room title, host, or description"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Minimum expected CGPA</span>
              <input
                value={cgpaThreshold}
                onChange={(event) => setCgpaThreshold(event.target.value)}
                className="tc-input"
                inputMode="decimal"
                placeholder="e.g. 3.40"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Department filtering</span>
              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="tc-select">
                <option value="all">All departments</option>
                {DEPARTMENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Sorting</span>
              <select value={sorting} onChange={(event) => setSorting(event.target.value as "newest" | "oldest")} className="tc-select">
                <option value="newest">Newest to Oldest</option>
                <option value="oldest">Oldest to Newest</option>
              </select>
            </label>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-[#E0E2E6] bg-white p-10 text-center">
              <p className="text-sm text-[#5B6472]">Loading partner rooms...</p>
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-2xl border border-[#F6C5C1] bg-[#FDECEC] p-6">
              <h2 className="font-semibold text-[#B42318]">Unable to load partner rooms</h2>
              <p className="mt-2 text-sm text-[#7F1D1D]">{loadError}</p>
              <Button type="button" variant="secondary" className="mt-4" onClick={() => void retryLoadRooms()}>
                Try again
              </Button>
            </div>
          ) : rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CBD2DC] bg-[#FBFCFD] p-10 text-center">
              <h2 className="text-xl font-semibold text-[#1F2937]">No partner rooms yet</h2>
              <p className="mt-2 text-sm text-[#5B6472]">Published rooms will appear here when they are available.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CBD2DC] bg-[#FBFCFD] p-10 text-center">
              <h2 className="text-xl font-semibold text-[#1F2937]">No rooms match your filters</h2>
              <p className="mt-2 text-sm text-[#5B6472]">Try adjusting CGPA or department filters, or create a new room.</p>
            </div>
          ) : (
            filtered.map((room) => <PartnerRoomCard key={room.id} room={room} applicationStatus={viewer?.statuses[room.id]} hosted={viewer?.hosted.includes(room.id)} canRequest={viewer !== null} />)
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <h2 className="text-xl font-semibold">My rooms</h2>
          <p className="mt-2 text-sm text-[#5B6472]">Review rooms you host and their join requests after signing in.</p>
          <LinkButton href="/partners/my-rooms" variant="secondary" className="mt-4">
            Open room management
          </LinkButton>
        </section>
      </main>
      <Footer />
    </div>
  );
}
