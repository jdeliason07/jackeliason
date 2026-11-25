import type { Metadata } from "next";
import Ventures from "@/components/meros/screens/Ventures";

export const metadata: Metadata = { title: "Ventures" };

export default function Page() {
  return <Ventures />;
}
