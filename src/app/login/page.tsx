import { LoginForm } from "./login-form";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";

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
    <div className="relative min-h-screen w-full bg-black">
      {/* ── Animated dot-matrix background ──────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-black"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
          reverse={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      {/* ── Existing login form (unchanged) ─────────────────────────── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-[10px] bg-brand-600 text-white">
              <SparkleMark className="h-7 w-7" />
            </div>
            <h1 className="font-display text-[28px] font-medium tracking-[-0.015em] text-white">
              JCorp <span className="font-extrabold">PMP</span>latform
            </h1>
            <p className="mt-1 text-[13px] text-slate-400">
              Source of truth for every JCorp HoldCo project.
            </p>
          </div>
          <div className="card">
            <div className="p-6">
              <LoginForm nextPath={searchParams.next} />
            </div>
          </div>
          <p className="mt-5 text-center text-[11px] text-slate-400">
            Access is restricted to the JCorp PMO Users Entra group. Contact your PMO administrator to be added.
          </p>
        </div>
      </div>
    </div>
  );
}
