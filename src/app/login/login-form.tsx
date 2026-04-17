"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const afterLogin = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath ?? "/")}`;

  async function signInWithGoogle() {
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: afterLogin, queryParams: { hd: "jcorp.my" } },
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
        onClick={signInWithGoogle}
        disabled={busy}
        className="btn-secondary w-full"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h5.9c-.3 1.4-1 2.6-2.2 3.4v2.8h3.5c2.1-1.9 3.3-4.8 3.3-8.3z"/>
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.8c-1 .7-2.2 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.9C3.9 20.7 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2s.1-1.3.4-2V7.1H2.1C1.4 8.6 1 10.3 1 12s.4 3.4 1.1 4.9l3.6-2.9z"/>
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.3 2.1 7.1l3.6 2.9C6.6 7.4 9.1 5.4 12 5.4z"/>
        </svg>
        Continue with JCorp Google
      </button>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <div className="h-px flex-1 bg-slate-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={signInWithMagicLink} className="space-y-3">
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@jcorp.my"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy || !email} className="btn-primary w-full">
          Email me a magic link
        </button>
      </form>
    </div>
  );
}
