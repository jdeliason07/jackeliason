import type { Metadata } from "next";
import QuestNew from "@/components/meros/screens/QuestNew";

export const metadata: Metadata = { title: "New quest" };

export default function Page() {
  return <QuestNew />;
}
