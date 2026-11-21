// Proxy Next.js 16 (anciennement « middleware ») : s'exécute avant chaque requête /admin.
//
// Vérification OPTIMISTE uniquement : présence du cookie, sans accès à la base
// (le proxy tourne aussi sur les préchargements de pages ; il doit rester rapide).
// La vraie vérification est faite par requireAdmin() dans chaque page et action.
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  sessionCookieOptions,
} from "@/server/auth/cookie";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Prolonge le cookie à chaque visite (la session en base est prolongée par requireAdmin).
  const response = NextResponse.next();
  if (request.method === "GET") {
    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(new Date(Date.now() + SESSION_DURATION_MS)),
    );
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
