import type { Metadata } from "next";
import Progress from "@/components/earned/screens/Progress";

export const metadata: Metadata = { title: "Progress" };

export default function Page() {
  return <Progress />;
}
