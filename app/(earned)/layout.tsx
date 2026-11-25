import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { APP_BASE_PATH, APP_NAME, APP_TAGLINE } from "@/lib/earned/config";
import "./earned.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  robots: { index: false, follow: false, nocache: true },
  manifest: `${APP_BASE_PATH}/manifest.webmanifest`,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: {
    icon: [{ url: `${APP_BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${APP_BASE_PATH}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffdf7",
  colorScheme: "light",
};

/** Applies the in-app reduced-motion setting before first paint. */
const motionScript = `(function(){try{if(localStorage.getItem("earned-motion")==="reduce")document.documentElement.setAttribute("data-motion","reduce")}catch(e){}})()`;

export default function EarnedRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
