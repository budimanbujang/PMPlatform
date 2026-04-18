import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireProfile } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <div className="app-shell">
      <Sidebar profile={profile} />
      <div className="app-main">
        <Topbar profile={profile} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
