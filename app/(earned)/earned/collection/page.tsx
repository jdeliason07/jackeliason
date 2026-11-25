import type { Metadata } from "next";
import Collection from "@/components/earned/screens/Collection";

export const metadata: Metadata = { title: "Collection" };

export default function Page() {
  return <Collection />;
}
