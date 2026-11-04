import { throwSafeDataError } from "./safe-errors";
import { requireBracUser } from "@/lib/auth/require-brac-user";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepartmentValue } from "@/lib/departments";

export type PublicPartnerRoom = {
  id: string;
  hostDisplayName: string;
  title: string;
  description: string;
  hostDepartment: DepartmentValue;
  hostCompletedCredits: number;
  hostCgpa: number | null;
  showHostCgpa: boolean;
  additionalMembersNeeded: number;
  expectedDepartment: DepartmentValue;
  expectedCgpaMin: number;
  expectedCgpaMax: number;
  minCompletedCredits: number;
  additionalInfo: string | null;
  createdAt: string;
  memberCount: number;
};

/**
 * The caller-controlled fields accepted by public.create_partner_room.
 * Host identity is intentionally absent: the RPC derives it from auth.uid()
 * and the caller's profile.
 */
export type CreatePartnerRoomInput = {
  title: string;
  description: string;
  hostCompletedCredits: number;
  hostCgpa: number | null;
  showHostCgpa: boolean;
  additionalMembersNeeded: number;
  expectedDepartment: DepartmentValue;
  expectedCgpaMin: number;
  expectedCgpaMax: number;
  minCompletedCredits: number;
  additionalInfo: string | null;
};

/** The caller-controlled fields accepted by public.submit_room_application. */
export type SubmitRoomApplicationInput = {
  roomId: string;
  department: DepartmentValue;
  cgpa: number;
  completedCredits: number;
  whyJoin: string;
  contactLink: string;
};

export type RoomApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type HostedPartnerRoom = {
  id: string;
  title: string;
  description: string;
  hostDepartment: DepartmentValue;
  additionalMembersNeeded: number;
  expectedDepartment: DepartmentValue;
  expectedCgpaMin: number;
  expectedCgpaMax: number;
  minCompletedCredits: number;
  additionalInfo: string | null;
  isOpen: boolean;
  createdAt: string;
};

export type HostedRoomApplication = {
  id: string;
  roomId: string;
  applicantDisplayName: string;
  department: DepartmentValue;
  cgpa: number;
  completedCredits: number;
  whyJoin: string;
  status: RoomApplicationStatus;
  createdAt: string;
};

export type AcceptedRoomMembership = {
  id: string;
  roomId: string;
  applicationId: string;
  createdAt: string;
};

export type HostedRoomDashboard = HostedPartnerRoom & {
  memberCount: number;
  remainingCapacity: number;
  pendingApplications: HostedRoomApplication[];
  acceptedMembers: Array<
    AcceptedRoomMembership & {
      applicantDisplayName: string | null;
      department: DepartmentValue | null;
    }
  >;
};

export type RoomApplicationDecision = "accepted" | "rejected";

export type OwnRoomApplication = {
  id: string;
  roomId: string;
  roomTitle: string | null;
  department: DepartmentValue;
  cgpa: number;
  completedCredits: number;
  whyJoin: string;
  status: RoomApplicationStatus;
  createdAt: string;
};

type PartnerRoomPublicRow = {
  id: string;
  host_display_name: string;
  title: string;
  description: string;
  host_department: DepartmentValue;
  host_completed_credits: number;
  host_cgpa: number | null;
  show_host_cgpa: boolean;
  additional_members_needed: number;
  expected_department: DepartmentValue;
  expected_cgpa_min: number;
  expected_cgpa_max: number;
  min_completed_credits: number;
  additional_info: string | null;
  created_at: string;
  member_count: number;
};

const PUBLIC_ROOM_COLUMNS =
  "id, host_display_name, title, description, host_department, host_completed_credits, host_cgpa, show_host_cgpa, additional_members_needed, expected_department, expected_cgpa_min, expected_cgpa_max, min_completed_credits, additional_info, created_at, member_count";

function toPublicPartnerRoom(row: PartnerRoomPublicRow): PublicPartnerRoom {
  return {
    id: row.id,
    hostDisplayName: row.host_display_name,
    title: row.title,
    description: row.description,
    hostDepartment: row.host_department,
    hostCompletedCredits: row.host_completed_credits,
    hostCgpa: row.host_cgpa,
    showHostCgpa: row.show_host_cgpa,
    additionalMembersNeeded: row.additional_members_needed,
    expectedDepartment: row.expected_department,
    expectedCgpaMin: row.expected_cgpa_min,
    expectedCgpaMax: row.expected_cgpa_max,
    minCompletedCredits: row.min_completed_credits,
    additionalInfo: row.additional_info,
    createdAt: row.created_at,
    memberCount: row.member_count,
  };
}

export async function listPublicPartnerRooms(
  supabase: SupabaseClient,
): Promise<PublicPartnerRoom[]> {
  const { data, error } = await supabase
    .from("partner_rooms_public")
    .select(PUBLIC_ROOM_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throwSafeDataError(error);
  }

  return (data ?? []).map((row) =>
    toPublicPartnerRoom(row as PartnerRoomPublicRow),
  );
}

export async function getPublicPartnerRoomById(
  supabase: SupabaseClient,
  roomId: string,
): Promise<PublicPartnerRoom | null> {
  const normalizedRoomId = roomId.trim();

  if (!normalizedRoomId) {
    return null;
  }

  const { data, error } = await supabase
    .from("partner_rooms_public")
    .select(PUBLIC_ROOM_COLUMNS)
    .eq("id", normalizedRoomId)
    .maybeSingle();

  if (error) {
    throwSafeDataError(error);
  }

  return data ? toPublicPartnerRoom(data as PartnerRoomPublicRow) : null;
}

/**
 * Creates a room through the only supported mutation path. The RPC returns
 * the UUID of the created partner_rooms record.
 */
export async function createPartnerRoom(
  supabase: SupabaseClient,
  input: CreatePartnerRoomInput,
): Promise<string> {
  await requireBracUser(supabase);
  const { data, error } = await supabase.rpc("create_partner_room", {
    p_title: input.title,
    p_description: input.description,
    p_host_completed_credits: input.hostCompletedCredits,
    p_host_cgpa: input.hostCgpa,
    p_show_host_cgpa: input.showHostCgpa,
    p_additional_members_needed: input.additionalMembersNeeded,
    p_expected_department: input.expectedDepartment,
    p_expected_cgpa_min: input.expectedCgpaMin,
    p_expected_cgpa_max: input.expectedCgpaMax,
    p_min_completed_credits: input.minCompletedCredits,
    p_additional_info: input.additionalInfo,
  });

  if (error) {
    throwSafeDataError(error);
  }

  if (typeof data !== "string" || !data) {
    throw new Error("Room creation did not return a room ID.");
  }

  return data;
}

/** Returns the UUID of the newly-created room_join_applications record. */
export async function submitRoomApplication(
  supabase: SupabaseClient,
  input: SubmitRoomApplicationInput,
): Promise<string> {
  await requireBracUser(supabase);
  const { data, error } = await supabase.rpc("submit_room_application", {
    p_room_id: input.roomId,
    p_department: input.department,
    p_cgpa: input.cgpa,
    p_completed_credits: input.completedCredits,
    p_why_join: input.whyJoin,
    p_contact_link: input.contactLink,
  });

  if (error) {
    throwSafeDataError(error);
  }

  if (typeof data !== "string" || !data) {
    throw new Error("Application submission did not return an application ID.");
  }

  return data;
}

/**
 * Withdraws the authenticated caller's pending application. The RPC returns
 * void and enforces applicant ownership and pending status in the database.
 */
export async function withdrawRoomApplication(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<void> {
  await requireBracUser(supabase);
  const { error } = await supabase.rpc("withdraw_room_application", {
    p_application_id: applicationId,
  });

  if (error) {
    throwSafeDataError(error);
  }
}

const OWN_APPLICATION_COLUMNS =
  "id, room_id, department, cgpa, completed_credits, why_join, status, created_at";
const PUBLIC_ROOM_TITLE_COLUMNS = "id, title";

type OwnRoomApplicationRow = {
  id: string;
  room_id: string;
  department: DepartmentValue;
  cgpa: number;
  completed_credits: number;
  why_join: string;
  status: RoomApplicationStatus;
  created_at: string;
};

type PublicRoomTitleRow = {
  id: string;
  title: string;
};

/**
 * Lists application records for the authenticated user only. RLS enforces the
 * same boundary; the session-derived filter keeps the applicant-facing UI
 * scoped to the caller when a trusted admin role has broader read access.
 */
export async function listOwnRoomApplications(
  supabase: SupabaseClient,
): Promise<OwnRoomApplication[]> {
  const user = await requireBracUser(supabase);

  const { data, error } = await supabase
    .from("room_join_applications")
    .select(OWN_APPLICATION_COLUMNS)
    .eq("applicant_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throwSafeDataError(error);
  }

  const applications = (data ?? []).map((row) =>
    toOwnRoomApplication(row as OwnRoomApplicationRow),
  );
  const roomIds = [...new Set(applications.map((application) => application.roomId))];
  const roomTitles = new Map<string, string>();

  if (roomIds.length > 0) {
    const { data: rooms, error: roomsError } = await supabase
      .from("partner_rooms_public")
      .select(PUBLIC_ROOM_TITLE_COLUMNS)
      .in("id", roomIds);

    if (roomsError) {
      throwSafeDataError(roomsError);
    }

    for (const room of rooms ?? []) {
      const publicRoom = room as PublicRoomTitleRow;
      roomTitles.set(publicRoom.id, publicRoom.title);
    }
  }

  return applications.map((application) => ({
    ...application,
    roomTitle: roomTitles.get(application.roomId) ?? null,
  }));
}

const HOSTED_ROOM_COLUMNS =
  "id, title, description, host_department, additional_members_needed, expected_department, expected_cgpa_min, expected_cgpa_max, min_completed_credits, additional_info, is_open, created_at";
const HOSTED_APPLICATION_COLUMNS =
  "id, room_id, applicant_display_name, department, cgpa, completed_credits, why_join, status, created_at";
const ACCEPTED_MEMBERSHIP_COLUMNS =
  "id, room_id, application_id, created_at";

type HostedPartnerRoomRow = {
  id: string;
  title: string;
  description: string;
  host_department: DepartmentValue;
  additional_members_needed: number;
  expected_department: DepartmentValue;
  expected_cgpa_min: number;
  expected_cgpa_max: number;
  min_completed_credits: number;
  additional_info: string | null;
  is_open: boolean;
  created_at: string;
};

type HostedRoomApplicationRow = {
  id: string;
  room_id: string;
  applicant_display_name: string;
  department: DepartmentValue;
  cgpa: number;
  completed_credits: number;
  why_join: string;
  status: RoomApplicationStatus;
  created_at: string;
};

type AcceptedRoomMembershipRow = {
  id: string;
  room_id: string;
  application_id: string;
  created_at: string;
};

export async function listHostedPartnerRooms(
  supabase: SupabaseClient,
): Promise<HostedPartnerRoom[]> {
  await requireBracUser(supabase);
  const { data, error } = await supabase
    .from("partner_rooms")
    .select(HOSTED_ROOM_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throwSafeDataError(error);
  }

  return (data ?? []).map((row) => toHostedPartnerRoom(row as HostedPartnerRoomRow));
}

export async function listHostedRoomApplications(
  supabase: SupabaseClient,
  roomId: string,
): Promise<HostedRoomApplication[]> {
  await requireBracUser(supabase);
  const normalizedRoomId = roomId.trim();
  if (!normalizedRoomId) {
    throw new Error("A room ID is required to list applications.");
  }

  const { data, error } = await supabase
    .from("room_join_applications")
    .select(HOSTED_APPLICATION_COLUMNS)
    .eq("room_id", normalizedRoomId)
    .order("created_at", { ascending: true });

  if (error) {
    throwSafeDataError(error);
  }

  return (data ?? []).map((row) => toHostedRoomApplication(row as HostedRoomApplicationRow));
}

export async function listAcceptedRoomMemberships(
  supabase: SupabaseClient,
  roomId: string,
): Promise<AcceptedRoomMembership[]> {
  await requireBracUser(supabase);
  const normalizedRoomId = roomId.trim();
  if (!normalizedRoomId) {
    throw new Error("A room ID is required to list memberships.");
  }

  const { data, error } = await supabase
    .from("room_memberships")
    .select(ACCEPTED_MEMBERSHIP_COLUMNS)
    .eq("room_id", normalizedRoomId)
    .eq("membership_role", "member")
    .order("created_at", { ascending: true });

  if (error) {
    throwSafeDataError(error);
  }

  return (data ?? []).map((row) =>
    toAcceptedRoomMembership(row as AcceptedRoomMembershipRow),
  );
}

export async function listHostedRoomDashboards(
  supabase: SupabaseClient,
): Promise<HostedRoomDashboard[]> {
  await requireBracUser(supabase);
  const rooms = await listHostedPartnerRooms(supabase);

  return Promise.all(
    rooms.map(async (room) => {
      const [applications, memberships] = await Promise.all([
        listHostedRoomApplications(supabase, room.id),
        listAcceptedRoomMemberships(supabase, room.id),
      ]);
      const applicationsById = new Map(
        applications.map((application) => [application.id, application]),
      );
      const memberCount = memberships.length + 1;

      return {
        ...room,
        memberCount,
        remainingCapacity: Math.max(
          room.additionalMembersNeeded - Math.max(memberCount - 1, 0),
          0,
        ),
        pendingApplications: applications.filter(
          (application) => application.status === "pending",
        ),
        acceptedMembers: memberships.map((membership) => {
          const application = applicationsById.get(membership.applicationId);

          return {
            ...membership,
            applicantDisplayName: application?.applicantDisplayName ?? null,
            department: application?.department ?? null,
          };
        }),
      };
    }),
  );
}

export async function decideRoomApplication(
  supabase: SupabaseClient,
  applicationId: string,
  decision: RoomApplicationDecision,
): Promise<void> {
  await requireBracUser(supabase);
  const { error } = await supabase.rpc("decide_room_application", {
    p_application_id: applicationId,
    p_decision: decision,
    p_host_note: null,
  });

  if (error) {
    throwSafeDataError(error);
  }
}

function toHostedPartnerRoom(row: HostedPartnerRoomRow): HostedPartnerRoom {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    hostDepartment: row.host_department,
    additionalMembersNeeded: row.additional_members_needed,
    expectedDepartment: row.expected_department,
    expectedCgpaMin: row.expected_cgpa_min,
    expectedCgpaMax: row.expected_cgpa_max,
    minCompletedCredits: row.min_completed_credits,
    additionalInfo: row.additional_info,
    isOpen: row.is_open,
    createdAt: row.created_at,
  };
}

function toOwnRoomApplication(row: OwnRoomApplicationRow): Omit<OwnRoomApplication, "roomTitle"> {
  return {
    id: row.id,
    roomId: row.room_id,
    department: row.department,
    cgpa: row.cgpa,
    completedCredits: row.completed_credits,
    whyJoin: row.why_join,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toHostedRoomApplication(
  row: HostedRoomApplicationRow,
): HostedRoomApplication {
  return {
    id: row.id,
    roomId: row.room_id,
    applicantDisplayName: row.applicant_display_name,
    department: row.department,
    cgpa: row.cgpa,
    completedCredits: row.completed_credits,
    whyJoin: row.why_join,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toAcceptedRoomMembership(
  row: AcceptedRoomMembershipRow,
): AcceptedRoomMembership {
  return {
    id: row.id,
    roomId: row.room_id,
    applicationId: row.application_id,
    createdAt: row.created_at,
  };
}
