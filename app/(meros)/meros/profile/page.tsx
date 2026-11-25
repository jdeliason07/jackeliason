import type { Metadata } from "next";
import Profile from "@/components/meros/screens/Profile";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <Profile />;
}
