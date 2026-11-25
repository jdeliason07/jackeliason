import type { Metadata } from "next";
import Onboarding from "@/components/meros/screens/Onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default function Page() {
  return <Onboarding />;
}
