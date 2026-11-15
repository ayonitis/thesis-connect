"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import Link from "next/link";

type RoomNotification = {
  id: string;
  room_id: string;
  event: "pending" | "accepted" | "rejected";
  created_at: string;
  read_at: string | null;
};

function RoomNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RoomNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = createClient();
    let active = true;
    let generation = 0;
    async function load() {
      const request = ++generation;
      const [list, count] = await Promise.all([
        client.from("room_notifications").select("id,room_id,event,created_at,read_at")
          .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30),
        client.from("room_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      if (!active || request !== generation) return;
      setError(Boolean(list.error || count.error));
      if (!list.error) setItems(list.data ?? []);
      if (!count.error) setUnread(count.count ?? 0);
    }
    const refresh = () => { void load(); };
    const channel = client.channel("room-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "room_notifications" }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("room-notifications-read", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("room-notifications-read", refresh);
      void client.removeChannel(channel);
    };
  }, []);

  async function markRead(id?: string) {
    const query = createClient().from("room_notifications")
      .update({ read_at: new Date().toISOString() }).is("read_at", null);
    const result = await (id ? query.eq("id", id) : query);
    if (result.error) setError(true);
    else window.dispatchEvent(new Event("room-notifications-read"));
  }

  return (
    <div className="relative">
      <button type="button" aria-label={`Notifications (${unread} unread)`} aria-expanded={open}
        className="relative rounded-md bg-white p-2 text-slate-900 focus-visible:outline" onClick={() => setOpen(!open)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-red-700 px-1 text-xs text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && <section aria-label="Room notifications" className="absolute right-0 z-50 mt-2 max-h-80 w-64 overflow-auto rounded-xl border bg-white p-3 text-sm text-slate-900 shadow-lg">
        <h2 className="font-semibold">Notifications</h2>
        {unread > 0 && <button type="button" className="underline" onClick={() => void markRead()}>Mark all as read</button>}
        {error && <p role="status">Notifications are temporarily unavailable.</p>}
        {!error && items.length === 0 && <p>No notifications yet.</p>}
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className={item.read_at ? "p-2" : "rounded bg-blue-50 p-2"}>
              <Link className="block font-semibold underline" href={`/partners/${item.room_id}`} onClick={() => setOpen(false)}>
                {item.event === "pending" ? "New room application" : item.event === "accepted" ? "Application accepted" : "Application rejected"}
              </Link>
              <p>{item.event === "pending" ? "A student requested to join your room." : "The host made a decision on your request."}</p>
              <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
              {!item.read_at && <button type="button" className="block underline" onClick={() => void markRead(item.id)}>Mark as read</button>}
            </li>
          ))}
        </ul>
      </section>}
    </div>
  );
}

export function AuthNavigation() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const signedIn = Boolean(userId);
  useEffect(() => {
    let active = true;
    let changed = false;
    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        changed = true;
        if (active) setUserId(session?.user.id ?? null);
      });
      void supabase.auth.getUser().then(({ data, error }) => {
        if (active && !changed) setUserId(error ? null : data.user?.id ?? null);
      }).catch(() => { if (active && !changed) setUserId(null); });
      return () => { active = false; data.subscription.unsubscribe(); };
    } catch {
      // No private configuration details belong in the navigation.
      void Promise.resolve().then(() => { if (active) setUserId(null); });
    }
    return () => { active = false; };
  }, []);

  if (userId === undefined) return <span className="px-4 py-2 text-sm text-white/80" role="status">Loading account…</span>;
  // Navigation is presentation only; profile routes retain server Auth/BRAC guards.
  return <div className="flex items-center gap-2">{userId && <RoomNotifications key={userId} />}<LinkButton href={signedIn ? "/profile" : "/sign-in"} variant={signedIn ? "profile" : "auth"}>
    {signedIn ? "Profile" : "Sign In"}
  </LinkButton></div>;
}
