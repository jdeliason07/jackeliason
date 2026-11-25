import type { Metadata } from "next";
import Quests from "@/components/meros/screens/Quests";

export const metadata: Metadata = { title: "Quests" };

export default function Page() {
  return <Quests />;
}
