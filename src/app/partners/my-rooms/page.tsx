"use client";

import { useCallback, useEffect, useState } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import {
  decideRoomApplication,
  listOwnRoomApplications,
  listHostedRoomDashboards,
  withdrawRoomApplication,
  type HostedRoomDashboard,
  type OwnRoomApplication,
  type RoomApplicationDecision,
} from "@/lib/data/partner-rooms";
import { createClient } from "@/lib/supabase/client";

export default function MyRoomsPage() {
  const [rooms, setRooms] = useState<HostedRoomDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const [decidingApplicationId, setDecidingApplicationId] = useState<string | null>(null);
  const [applications, setApplications] = useState<OwnRoomApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [withdrawalConfirmationId, setWithdrawalConfirmationId] = useState<string | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] = useState<string | null>(null);
  const [withdrawalNotice, setWithdrawalNotice] = useState<string | null>(null);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setRooms(await listHostedRoomDashboards(createClient()));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load your hosted rooms. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listHostedRoomDashboards(createClient())
      .then((dashboard) => {
        if (!cancelled) {
          setRooms(dashboard);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your hosted rooms. Please try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadApplications = useCallback(async () => {
    try {
      setApplications(await listOwnRoomApplications(createClient()));
      setApplicationsError(null);
    } catch (error) {
      setApplicationsError(
        error instanceof Error
          ? error.message
          : "Unable to load your applications. Please try again.",
      );
    } finally {
      setIsLoadingApplications(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listOwnRoomApplications(createClient())
      .then((ownApplications) => {
        if (!cancelled) {
          setApplications(ownApplications);
          setApplicationsError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setApplicationsError(
            error instanceof Error
              ? error.message
              : "Unable to load your applications. Please try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApplications(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const decideApplication = async (
    applicationId: string,
    decision: RoomApplicationDecision,
  ) => {
    if (decidingApplicationId) return;

    setDecisionError(null);
    setDecisionNotice(null);
    setDecidingApplicationId(applicationId);

    try {
      await decideRoomApplication(createClient(), applicationId, decision);
      setDecisionNotice(
        decision === "accepted"
          ? "Application accepted. Room capacity and memberships were refreshed."
          : "Application rejected.",
      );
      setIsLoading(true);
      await loadDashboard();
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "Unable to decide this application. Please try again.",
      );
    } finally {
      setDecidingApplicationId(null);
    }
  };

  const withdrawApplication = async (applicationId: string) => {
    if (withdrawingApplicationId) return;

    setWithdrawalError(null);
    setWithdrawalNotice(null);
    setWithdrawingApplicationId(applicationId);

    try {
      await withdrawRoomApplication(createClient(), applicationId);
      setWithdrawalConfirmationId(null);
      setWithdrawalNotice("Application withdrawn successfully.");
      setIsLoadingApplications(true);
      await loadApplications();
    } catch (error) {
      setWithdrawalError(
        error instanceof Error
          ? error.message
          : "Unable to withdraw this application. Please try again.",
      );
    } finally {
      setWithdrawingApplicationId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/partners"
          title="My Rooms"
          description="Review the rooms you host and the Partner Room applications you have submitted."
        />

        {decisionNotice ? (
          <p className="mb-5 rounded-xl border border-[#BFD9C1] bg-[#EFFAF0] p-4 text-sm text-[#204D25]" role="status">
            {decisionNotice}
          </p>
        ) : null}
        {decisionError ? (
          <p className="mb-5 rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]" role="alert">
            {decisionError}
          </p>
        ) : null}

        {isLoading ? (
          <section className="rounded-2xl border border-[#E0E2E6] bg-white p-6 text-sm text-[#5B6472]" role="status">
            Loading your hosted rooms…
          </section>
        ) : null}

        {!isLoading && loadError ? (
          <section className="rounded-2xl border border-[#F2C5C2] bg-[#FFF4F3] p-6 text-[#B42318]" role="alert">
            <h2 className="text-xl font-semibold">Unable to load My Rooms</h2>
            <p className="mt-2 text-sm">{loadError}</p>
            <div className="mt-4"><Button variant="secondary" onClick={() => { setIsLoading(true); void loadDashboard(); }}>Try again</Button></div>
          </section>
        ) : null}

        {!isLoading && !loadError && rooms.length === 0 ? (
          <section className="rounded-2xl border border-[#E0E2E6] bg-white p-6 text-sm text-[#5B6472]">
            You have not created any rooms yet.
          </section>
        ) : null}

        {!isLoading && !loadError ? (
          <div className="space-y-6">
            {rooms.map((room) => {
              const acceptsMembers = room.isOpen && room.remainingCapacity > 0;

              return (
                <section key={room.id} className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-[#1F2937]">{room.title}</h2>
                      <p className="mt-1 text-sm text-[#5B6472]">{room.description}</p>
                    </div>
                    <span className={room.isOpen ? "rounded-full bg-[#EAF6EC] px-3 py-1 text-xs font-medium text-[#204D25]" : "rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#4B5563]"}>
                      {room.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-[#4B5563] sm:grid-cols-3">
                    <p><span className="font-medium text-[#1F2937]">Members:</span> {room.memberCount}</p>
                    <p><span className="font-medium text-[#1F2937]">Additional members needed:</span> {room.additionalMembersNeeded}</p>
                    <p><span className="font-medium text-[#1F2937]">Remaining capacity:</span> {room.remainingCapacity}</p>
                  </div>
                  <p className="mt-2 text-sm text-[#4B5563]">
                    Looking for {room.expectedDepartment} students with CGPA {room.expectedCgpaMin.toFixed(2)}–{room.expectedCgpaMax.toFixed(2)} and at least {room.minCompletedCredits} completed credits.
                  </p>
                  {room.additionalInfo ? <p className="mt-2 text-sm text-[#4B5563]">{room.additionalInfo}</p> : null}

                  <div className="mt-6 border-t border-[#E8EBEF] pt-5">
                    <h3 className="text-lg font-semibold text-[#1F2937]">Pending applications</h3>
                    {room.pendingApplications.length === 0 ? (
                      <p className="mt-3 text-sm text-[#5B6472]">No pending applications for this room.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {room.pendingApplications.map((application) => {
                          const isDeciding = decidingApplicationId === application.id;

                          return (
                            <article key={application.id} className="rounded-xl border border-[#E0E2E6] bg-[#FBFCFD] p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-medium text-[#1F2937]">{application.applicantDisplayName}</p>
                                  <p className="mt-1 text-sm text-[#5B6472]">{application.department} · CGPA {application.cgpa.toFixed(2)} · {application.completedCredits} completed credits</p>
                                </div>
                                <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-xs font-medium text-[#8A4B00]">Pending</span>
                              </div>
                              <p className="mt-3 text-sm text-[#374151]">{application.whyJoin}</p>
                              <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <Button variant="secondary" onClick={() => void decideApplication(application.id, "rejected")} disabled={Boolean(decidingApplicationId)}>{isDeciding ? "Saving…" : "Reject"}</Button>
                                <Button onClick={() => void decideApplication(application.id, "accepted")} disabled={Boolean(decidingApplicationId) || !acceptsMembers}>{isDeciding ? "Saving…" : "Accept"}</Button>
                              </div>
                              {!acceptsMembers ? <p className="mt-3 text-xs text-[#8A4B00]">Acceptance is unavailable because this room is closed or has no remaining capacity.</p> : null}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 border-t border-[#E8EBEF] pt-5">
                    <h3 className="text-lg font-semibold text-[#1F2937]">Accepted members</h3>
                    {room.acceptedMembers.length === 0 ? (
                      <p className="mt-3 text-sm text-[#5B6472]">No accepted members yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm text-[#374151]">
                        {room.acceptedMembers.map((member) => (
                          <li key={member.id} className="rounded-xl border border-[#E0E2E6] bg-[#FBFCFD] p-3">
                            <span className="font-medium">{member.applicantDisplayName ?? "Accepted member"}</span>
                            {member.department ? <span className="text-[#5B6472]"> · {member.department}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        <section className="mt-8 rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <h2 className="text-xl font-semibold text-[#1F2937]">My Applications</h2>
          <p className="mt-1 text-sm text-[#5B6472]">
            Review your submitted Partner Room applications and withdraw pending requests if needed.
          </p>

          {withdrawalNotice ? (
            <p className="mt-4 rounded-xl border border-[#BFD9C1] bg-[#EFFAF0] p-4 text-sm text-[#204D25]" role="status">
              {withdrawalNotice}
            </p>
          ) : null}
          {withdrawalError ? (
            <p className="mt-4 rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]" role="alert">
              {withdrawalError}
            </p>
          ) : null}

          {isLoadingApplications ? (
            <p className="mt-4 text-sm text-[#5B6472]" role="status">Loading your applications…</p>
          ) : applicationsError ? (
            <div className="mt-4 rounded-xl border border-[#F2C5C2] bg-[#FFF4F3] p-4 text-sm text-[#B42318]" role="alert">
              <p>{applicationsError}</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={() => { setIsLoadingApplications(true); void loadApplications(); }}>
                Try again
              </Button>
            </div>
          ) : applications.length === 0 ? (
            <p className="mt-4 text-sm text-[#5B6472]">You have not submitted any Partner Room applications yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {applications.map((application) => {
                const isPending = application.status === "pending";
                const isConfirmingWithdrawal = withdrawalConfirmationId === application.id;
                const isWithdrawing = withdrawingApplicationId === application.id;

                return (
                  <article key={application.id} className="rounded-xl border border-[#E0E2E6] bg-[#FBFCFD] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-medium text-[#1F2937]">{application.roomTitle ?? "Partner room"}</h3>
                        <p className="mt-1 text-sm text-[#5B6472]">
                          Submitted {new Date(application.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                        {application.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-[#4B5563]">
                      {application.department} · CGPA {application.cgpa.toFixed(2)} · {application.completedCredits} completed credits
                    </p>
                    <p className="mt-2 text-sm text-[#374151]">{application.whyJoin}</p>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <LinkButton href={`/partners/${application.roomId}`} variant="secondary">
                        View room details
                      </LinkButton>
                      {isPending && !isConfirmingWithdrawal ? (
                        <Button variant="ghost" onClick={() => setWithdrawalConfirmationId(application.id)} disabled={Boolean(withdrawingApplicationId)}>
                          Withdraw application
                        </Button>
                      ) : null}
                    </div>

                    {isConfirmingWithdrawal ? (
                      <div className="mt-4 rounded-xl border border-[#F1D7A7] bg-[#FFF9EC] p-3 text-sm text-[#7A4C00]">
                        <p>Withdraw this pending application?</p>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button variant="secondary" onClick={() => setWithdrawalConfirmationId(null)} disabled={isWithdrawing}>
                            Keep application
                          </Button>
                          <Button onClick={() => void withdrawApplication(application.id)} disabled={isWithdrawing}>
                            {isWithdrawing ? "Withdrawing…" : "Confirm withdrawal"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
