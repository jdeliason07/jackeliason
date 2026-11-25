import type { Metadata } from "next";
import TaskNew from "@/components/meros/screens/TaskNew";

export const metadata: Metadata = { title: "New task" };

export default function Page() {
  return <TaskNew />;
}
