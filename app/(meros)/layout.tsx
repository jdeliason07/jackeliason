import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Exo_2, Inter } from "next/font/google";
import { APP_BASE_PATH, APP_NAME, APP_TAGLINE } from "@/lib/meros/config";
import "./meros.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const barlow = Barlow_Condensed({ subsets: ["latin"], variable: "--font-barlow", weight: ["600", "700", "800"] });
/** The wordmark face (lowercase "meros"). */
const exo = Exo_2({ subsets: ["latin"], variable: "--font-exo", weight: "800", style: "italic" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  robots: { index: false, follow: false, nocache: true },
  manifest: `${APP_BASE_PATH}/manifest.webmanifest`,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
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
  themeColor: "#121211",
  colorScheme: "dark",
};

/** Applies the in-app reduced-motion setting before first paint. */
const motionScript = `(function(){try{if(localStorage.getItem("meros-motion")==="reduce")document.documentElement.setAttribute("data-motion","reduce")}catch(e){}})()`;

export default function MerosRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} ${exo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
