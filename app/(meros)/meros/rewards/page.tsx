import type { Metadata } from "next";
import Rewards from "@/components/meros/screens/Rewards";

export const metadata: Metadata = { title: "Rewards" };

export default function Page() {
  return <Rewards />;
}
