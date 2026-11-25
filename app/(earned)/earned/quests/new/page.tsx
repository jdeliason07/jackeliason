import type { Metadata } from "next";
import QuestNew from "@/components/earned/screens/QuestNew";

export const metadata: Metadata = { title: "New quest" };

export default function Page() {
  return <QuestNew />;
}
