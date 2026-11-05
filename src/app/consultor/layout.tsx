import { AppHeader } from "@/components/layout/app-header";
import { ConsultorNav } from "@/components/layout/consultor-nav";
import { requireStaff } from "@/lib/auth";

export default async function ConsultorLayout({ children }: LayoutProps<"/consultor">) {
  const { profile } = await requireStaff();
  return (
    <>
      <AppHeader profile={profile} href="/consultor" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:py-10">
        <aside className="lg:w-52 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <ConsultorNav isAdmin={profile.role === "admin"} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
