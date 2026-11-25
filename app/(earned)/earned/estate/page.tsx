import type { Metadata } from "next";
import Estate from "@/components/earned/screens/Estate";

export const metadata: Metadata = { title: "Estate" };

export default function Page() {
  return <Estate />;
}
