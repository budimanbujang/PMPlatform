import { LoginForm } from "./login-form";
import { publicEnv } from "@/lib/env";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const { APP_NAME } = publicEnv();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold">
            J
          </div>
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <p className="text-sm text-slate-600">
            Source of truth for every JCorp HoldCo project.
          </p>
        </div>
        <div className="card">
          <div className="card-body">
            <LoginForm nextPath={searchParams.next} />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Access is restricted to users with @jcorp.my accounts. Contact the PMO for onboarding.
        </p>
      </div>
    </div>
  );
}
