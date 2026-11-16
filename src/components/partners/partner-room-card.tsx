import type { PublicPartnerRoom, RoomApplicationStatus } from "@/lib/data/partner-rooms";
import { LinkButton } from "@/components/ui/button";

export function PartnerRoomCard({ room, applicationStatus, hosted, canRequest }: { room: PublicPartnerRoom; applicationStatus?: RoomApplicationStatus; hosted?: boolean; canRequest?: boolean }) {
  const acceptedParticipants = Math.max(room.memberCount - 1, 0);
  const remaining = Math.max(room.additionalMembersNeeded - acceptedParticipants, 0);

  return (
    <article className="relative rounded-2xl border border-[#DCE0E6] bg-white p-5 shadow-[0_6px_20px_rgba(16,24,40,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-xl font-semibold leading-tight text-[#191C21]">{room.title}</h3>
        <span className="rounded-full border border-[#D9DEE6] bg-[#F7F8FA] px-2.5 py-1 text-xs font-medium text-[#3B4554]">
          {room.hostDepartment}
        </span>
      </div>

      <p className="mt-2 text-sm text-[#4F5866]">Hosted by {room.hostDisplayName}</p>

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[#394253] sm:grid-cols-2">
        <p>
          <span className="font-medium">Completed credits:</span> {room.hostCompletedCredits}
        </p>
        {room.showHostCgpa && room.hostCgpa !== null ? (
          <p>
            <span className="font-medium">Host CGPA:</span> {room.hostCgpa.toFixed(2)}
          </p>
        ) : null}
      </div>

      <p className="mt-4 line-clamp-3 text-sm text-[#4D5663]">{room.description}</p>

      <section className="mt-4 rounded-xl border border-[#E2E6EB] bg-[#FAFBFC] p-3">
        <h4 className="text-sm font-semibold text-[#212B36]">What the host is looking for</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-[#4B5563]">
          <li>
            Expected CGPA: {room.expectedCgpaMin.toFixed(2)}–{room.expectedCgpaMax.toFixed(2)}
          </li>
          <li>Department: {room.expectedDepartment}</li>
          <li>Minimum completed credits: {room.minCompletedCredits}</li>
        </ul>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <LinkButton href={`/partners/${room.id}`} variant="lightBlue">
          View room details
        </LinkButton>
        <div className="text-xs text-[#485362]">
          <p>Accepted Participants: {acceptedParticipants}</p>
          <p>Additional Members Remaining: {remaining}</p>
        </div>
        {hosted ? <span>Your Room</span> : applicationStatus ? (
          <RoomApplicationStatusBadge status={applicationStatus} />
        ) : canRequest && remaining > 0 ? <LinkButton href={`/partners/${room.id}/join`} variant="lightBlue">Request to Join</LinkButton> : null}
      </div>
    </article>
  );
}

export function RoomApplicationStatusBadge({ status }: { status: RoomApplicationStatus }) {
  return (
    <span aria-disabled="true" className={status === "accepted" ? "rounded px-2 py-1 bg-green-100 text-green-900" : status === "rejected" ? "rounded px-2 py-1 bg-red-100 text-red-900" : "rounded px-2 py-1 bg-amber-100 text-amber-900"}>
      {status === "accepted" ? "Accepted" : status === "rejected" ? "Rejected" : status === "withdrawn" ? "Withdrawn" : "Pending"}
    </span>
  );
}
