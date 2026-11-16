import { notFound } from "next/navigation";
import { PartnerRoomForm } from "@/components/partners/partner-room-form";
import { BracEligibilityError } from "@/lib/auth/require-brac-user";
import { getHostedPartnerRoom } from "@/lib/data/partner-rooms";
import { createClient } from "@/lib/supabase/server";

export default async function EditRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(roomId)) notFound();

  const room = await getHostedPartnerRoom(await createClient(), roomId).catch((error: unknown) => {
    if (error instanceof BracEligibilityError) notFound();
    throw error;
  });
  if (!room) notFound();

  return <PartnerRoomForm room={room} />;
}
