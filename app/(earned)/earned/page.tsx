import type { Metadata } from "next";
import Today from "@/components/earned/screens/Today";

export const metadata: Metadata = { title: "Today" };

export default function Page() {
  return <Today />;
}
