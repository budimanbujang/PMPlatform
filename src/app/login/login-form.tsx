"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

// Set NEXT_PUBLIC_ENABLE_MAGIC_LINK=true to show the magic-link fallback form.
// Production (group-gated SSO) should have this off.
const ENABLE_MAGIC_LINK = process.env.NEXT_PUBLIC_ENABLE_MAGIC_LINK === "true";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const afterLogin = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath ?? "/")}`;

  async function signInWithMicrosoft() {
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: afterLogin,
        // Ask Entra ID for the scopes we need. "email" + "profile" give us
        // the user's display name and primary email. "openid" is required
        // for the id_token. "offline_access" lets Supabase refresh the session.
        scopes: "openid email profile offline_access",
      },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: afterLogin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Magic link sent — check your inbox.");
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
        Sign in with JCorp Microsoft account
      </button>

      <p className="text-center text-xs text-slate-500">
        Access is restricted to members of the <b>JCorp PMO Users</b> security group.
      </p>

      {ENABLE_MAGIC_LINK && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span>developer fallback</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={signInWithMagicLink} className="space-y-3">
            <div>
              <label className="label" htmlFor="email">Email (magic link)</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@jcorp.com.my"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" disabled={busy || !email} className="btn-secondary w-full">
              Email me a magic link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
