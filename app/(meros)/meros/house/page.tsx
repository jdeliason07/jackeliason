import type { Metadata } from "next";
import House from "@/components/meros/screens/House";

export const metadata: Metadata = { title: "House" };

export default function Page() {
  return <House />;
}
