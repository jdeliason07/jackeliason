import type { Metadata } from "next";
import QuestDetail from "@/components/earned/screens/QuestDetail";

export const metadata: Metadata = { title: "Quest" };

export default async function Page({ params }: PageProps<"/earned/quests/[id]">) {
  const { id } = await params;
  return <QuestDetail id={id} />;
}
