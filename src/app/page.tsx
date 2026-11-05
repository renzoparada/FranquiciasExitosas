import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";

export default async function Home() {
  const { profile } = await getSession();
  redirect(profile ? homeFor(profile.role) : "/login");
}
