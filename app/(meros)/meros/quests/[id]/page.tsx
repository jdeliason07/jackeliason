import type { Metadata } from "next";
import QuestDetail from "@/components/meros/screens/QuestDetail";

export const metadata: Metadata = { title: "Quest" };

export default async function Page({ params }: PageProps<"/meros/quests/[id]">) {
  const { id } = await params;
  return <QuestDetail id={id} />;
}
