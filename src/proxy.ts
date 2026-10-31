import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const AUTH_PAGES = new Set(["/sign-up"]);

function isProtectedPath(pathname: string) {
  if (
    pathname === "/partners/create" ||
    pathname === "/partners/my-rooms" ||
    pathname.startsWith("/admin/") ||
    pathname === "/faculty/post-review" ||
    pathname === "/sign-out"
  ) {
    return true;
  }

  if (pathname.startsWith("/partners/") && pathname.endsWith("/join")) {
    return true;
  }

  if (pathname.startsWith("/faculty/") && pathname.endsWith("/review")) {
    return true;
  }

  return false;
}

function requiresCompletedProfile(pathname: string) {
  if (pathname === "/partners/create" || pathname === "/partners/my-rooms" || pathname === "/faculty/post-review" || pathname.startsWith("/admin/")) {
    return true;
  }

  return (
    (pathname.startsWith("/partners/") && pathname.endsWith("/join")) ||
    (pathname.startsWith("/faculty/") && pathname.endsWith("/review"))
  );
}

function safeInternalNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/")) return "/";
  if (nextValue.startsWith("//")) return "/";
  return nextValue;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }

  const { response, user, profileStatus } = await updateSession(request);

  if (!user && (isProtectedPath(pathname) || pathname === "/profile/complete")) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (user && AUTH_PAGES.has(pathname)) {
    const nextParam = safeInternalNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextParam, request.url));
  }

  if (user && pathname === "/profile/complete" && profileStatus === "complete") {
    const nextPath = safeInternalNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (user && requiresCompletedProfile(pathname) && profileStatus === "incomplete") {
    const completeProfileUrl = new URL("/profile/complete", request.url);
    completeProfileUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(completeProfileUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
