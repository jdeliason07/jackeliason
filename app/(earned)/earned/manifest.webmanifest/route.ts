import { APP_BASE_PATH, APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from "@/lib/earned/config";

export const dynamic = "force-static";

/** Earned's own web app manifest, scoped to /earned so it never affects the rest of the site. */
export function GET() {
  const icon = (file: string, size: number, purpose?: string) => ({
    src: `${APP_BASE_PATH}/icons/${file}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    ...(purpose ? { purpose } : {}),
  });
  return new Response(
    JSON.stringify({
      id: `${APP_BASE_PATH}/`,
      name: APP_NAME,
      short_name: APP_SHORT_NAME,
      description: APP_TAGLINE,
      start_url: APP_BASE_PATH,
      scope: `${APP_BASE_PATH}/`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#fffdf7",
      theme_color: "#fffdf7",
      icons: [icon("icon-192.png", 192), icon("icon-512.png", 512), icon("icon-maskable-512.png", 512, "maskable")],
    }),
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
