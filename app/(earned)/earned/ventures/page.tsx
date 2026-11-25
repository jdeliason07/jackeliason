import type { Metadata } from "next";
import Ventures from "@/components/earned/screens/Ventures";

export const metadata: Metadata = { title: "Ventures" };

export default function Page() {
  return <Ventures />;
}
