import { LoginForm } from "./login-form";
import { publicEnv } from "@/lib/env";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const { APP_NAME } = publicEnv();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 bg-login-gradient-light dark:bg-login-gradient-dark">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-[10px] bg-brand-600 font-display text-[26px] font-extrabold text-white">
            J
          </div>
          <h1 className="font-display text-[28px] font-extrabold tracking-[-0.015em] text-fg1">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-[13px] text-fg3">
            Source of truth for every JCorp HoldCo project.
          </p>
        </div>
        <div className="card">
          <div className="p-6">
            <LoginForm nextPath={searchParams.next} />
          </div>
        </div>
        <p className="mt-5 text-center text-[11px] text-fg3">
          Access is restricted to the JCorp PMO Users Entra group. Contact your PMO administrator to be added.
        </p>
      </div>
    </div>
  );
}
