import Link from "next/link";
import { BrandLockup } from "@/components/escala/brand-lockup";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell, type Notice } from "./notification-bell";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth";

export async function AppHeader({
  profile,
  href,
  clientLogo,
  clientName,
  children,
}: {
  profile: Profile;
  href: string;
  clientLogo?: string | null;
  clientName?: string | null;
  children?: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at, type")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={href} className="min-w-0">
          <BrandLockup clientLogo={clientLogo} clientName={clientName} />
        </Link>
        <div className="flex items-center gap-1">
          {children}
          <NotificationBell userId={profile.id} initial={(notices ?? []) as Notice[]} />
          <ThemeToggle />
          <UserMenu name={profile.full_name} email={profile.email} role={profile.role} />
        </div>
      </div>
    </header>
  );
}
