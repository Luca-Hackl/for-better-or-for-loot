import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

// Next.js 16 "proxy" convention (formerly middleware). Runs before rendering to
// refresh the Supabase session and guard private routes.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets & image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
