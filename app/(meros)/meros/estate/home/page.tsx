import type { Metadata } from "next";
import Home from "@/components/meros/screens/Home";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <Home />;
}
