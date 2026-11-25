import type { Metadata } from "next";
import Estate from "@/components/meros/screens/Estate";

export const metadata: Metadata = { title: "Estate" };

export default function Page() {
  return <Estate />;
}
