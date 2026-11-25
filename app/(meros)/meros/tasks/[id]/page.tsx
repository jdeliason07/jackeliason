import type { Metadata } from "next";
import TaskDetail from "@/components/meros/screens/TaskDetail";

export const metadata: Metadata = { title: "Task" };

export default async function Page({ params }: PageProps<"/meros/tasks/[id]">) {
  const { id } = await params;
  return <TaskDetail id={id} />;
}
