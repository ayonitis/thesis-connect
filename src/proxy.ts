import { getSafeInternalRedirectPath } from "@/lib/auth/redirect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const AUTH_PAGES = new Set(["/sign-up"]);

function isProtectedPath(pathname: string) {
  if (
    pathname === "/partners/create" ||
    pathname === "/partners/my-rooms" ||
    (pathname === "/admin" || pathname.startsWith("/admin/")) ||
    pathname === "/faculty/post-review"
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
  if (pathname === "/partners/create" || pathname === "/partners/my-rooms" || pathname === "/faculty/post-review" || (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return true;
  }

  return (
    (pathname.startsWith("/partners/") && pathname.endsWith("/join")) ||
    (pathname.startsWith("/faculty/") && pathname.endsWith("/review"))
  );
}

const safeInternalNext = getSafeInternalRedirectPath;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }

  // Sign-out is an explicit recovery action, not protected application data.
  // Already signed-out, unverified and ineligible users all reach its confirmation UI.
  if (pathname === "/sign-out") return NextResponse.next();
  const { response, user, eligible, profileStatus } = await updateSession(request);
  const redirectWithCookies = (destination: URL) => {
    const redirected = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    for (const name of ["Cache-Control", "Expires", "Pragma"]) {
      const value = response.headers.get(name);
      if (value !== null) redirected.headers.set(name, value);
    }
    return redirected;
  };

  if ((!user || !eligible) && (isProtectedPath(pathname) || pathname === "/profile" || pathname.startsWith("/profile/"))) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(signInUrl);
  }

  const onboardingExempt = pathname === "/profile" || pathname.startsWith("/profile/")
    || pathname.startsWith("/auth/")
    || ["/sign-in", "/sign-up", "/verify-email", "/forgot-password", "/reset-password", "/privacy", "/community-guidelines", "/about"].includes(pathname);
  if (user && eligible && profileStatus === "incomplete" && !onboardingExempt) {
    const setup = new URL("/profile/complete", request.url);
    setup.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(setup);
  }

  if (user && eligible && AUTH_PAGES.has(pathname)) {
    const nextParam = safeInternalNext(request.nextUrl.searchParams.get("next"));
    return redirectWithCookies(new URL(nextParam, request.url));
  }

  if (user && eligible && pathname === "/profile/complete" && profileStatus === "complete") {
    const nextPath = safeInternalNext(request.nextUrl.searchParams.get("next"));
    return redirectWithCookies(new URL(nextPath, request.url));
  }

  if (user && eligible && requiresCompletedProfile(pathname) && profileStatus !== "complete") {
    const completeProfileUrl = new URL("/profile/complete", request.url);
    completeProfileUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(completeProfileUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
