import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes Earned's Supabase session cookies before /earned pages and APIs render (the pattern
 * @supabase/ssr documents for Next.js). Does nothing for the rest of the site, and nothing when
 * Supabase isn't configured (demo mode still works).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/earned/:path*"],
};
