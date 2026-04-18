import { LoginForm } from "./login-form";

// 4-point sparkle mark used as the JCorp PMPlatform brand glyph.
function SparkleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 1.5 L13.7 10.3 L22.5 12 L13.7 13.7 L12 22.5 L10.3 13.7 L1.5 12 L10.3 10.3 Z" />
    </svg>
  );
}

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 bg-login-gradient-light dark:bg-login-gradient-dark">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-[10px] bg-brand-600 text-white">
            <SparkleMark className="h-7 w-7" />
          </div>
          <h1 className="font-display text-[28px] font-medium tracking-[-0.015em] text-fg1">
            JCorp <span className="font-extrabold">PMP</span>latform
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
