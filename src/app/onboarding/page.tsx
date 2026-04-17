import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Assign to the default org if there's only one (MVP behaviour).
  const { data: orgs } = await supabase.from("organisations").select("id").limit(2);
  if (orgs?.length === 1) {
    await supabase.from("profiles").update({ organisation_id: orgs[0].id }).eq("id", user.id);
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md">
        <div className="card-body space-y-4 text-center">
          <h1 className="text-xl font-bold">Welcome to JCorp PMO</h1>
          <p className="text-sm text-slate-600">
            Your account is not yet attached to an organisation. Contact your PMO administrator to be
            added before you can see projects.
          </p>
          <p className="text-xs text-slate-400">Signed in as {user.email}</p>
        </div>
      </div>
    </div>
  );
}
