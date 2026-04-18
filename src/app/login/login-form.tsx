"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [busy, setBusy] = useState(false);

  async function signInWithMicrosoft() {
    setBusy(true);
    try {
      await signIn("azure-ad", {
        callbackUrl: nextPath ?? "/",
      });
      // signIn redirects the browser, nothing to do after.
    } catch (e: any) {
      toast.error(e?.message ?? "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signInWithMicrosoft}
        disabled={busy}
        className="btn-primary w-full"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23" aria-hidden>
          <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
          <rect x="12" y="1"  width="10" height="10" fill="#7FBA00"/>
          <rect x="1"  y="12" width="10" height="10" fill="#00A4EF"/>
          <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
        </svg>
        {busy ? "Redirecting…" : "Sign in with JCorp Microsoft account"}
      </button>

      <p className="text-center text-xs text-fg3">
        Access is restricted to members of the <b>JCorp PMO Users</b> security group.
      </p>
    </div>
  );
}
