import type { Metadata } from "next";
import Dress from "@/components/meros/screens/Dress";

export const metadata: Metadata = { title: "Dressing room" };

export default function Page() {
  return <Dress />;
}
