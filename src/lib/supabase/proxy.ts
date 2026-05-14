import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";

const publicRoutePrefixes = ["/login", "/demo", "/auth/callback"];

function isPublicRoute(pathname: string) {
  return publicRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request
    .cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (!hasSupabaseEnv() || isPublicRoute(pathname) || pathname.startsWith("/api/")) {
    return response;
  }

  if (!hasSupabaseAuthCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([header, value]) => {
            response.headers.set(header, value);
          });
        },
      },
    },
  );

  await supabase.auth.getClaims();

  return response;
}
