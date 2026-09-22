import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SignInButtons, SignInGate } from "@/lib/auth/gates";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithEmail() {
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) setMessage(result.error.message ?? "Sign-in failed.");
      else await navigate({ to: "/", search: { code: undefined, cat: undefined } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Check the account database configuration.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-6 text-fg sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-5xl overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-[var(--shadow-border)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden border-r border-border bg-bg-subtle p-10 lg:flex lg:flex-col lg:justify-between">
          <div><p className="text-[11px] uppercase tracking-[0.16em] text-accent">Oak & Ledger</p><p className="mt-8 max-w-xs font-display text-4xl leading-tight text-fg">Read the positioning. Mark the zone. Wait for the signal.</p></div>
          <p className="max-w-xs text-sm leading-relaxed text-muted">Your account keeps confirmed supply and demand zones separate from the market’s automatically generated context.</p>
        </aside>
        <section className="flex items-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.16em] text-accent lg:hidden">Oak & Ledger</p><h1 className="mt-2 font-display text-3xl">Welcome back</h1></div><Link to="/" search={{ code: undefined, cat: undefined }} className="text-xs text-muted hover:text-fg">Back to terminal</Link></div>
            <p className="mt-3 text-sm leading-relaxed text-muted">Sign in to save zones and keep your Thursday alerts tied to your account.</p>
            <SignInGate fallback={<div className="mt-8 space-y-6">
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void signInWithEmail(); }}>
                <label className="block text-xs text-muted">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input" autoComplete="email" /></label>
                <label className="block text-xs text-muted">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input" autoComplete="current-password" /></label>
                <button type="submit" disabled={busy} className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-60">{busy ? "Signing in..." : "Sign in"}</button>
                {message ? <p role="alert" className="rounded-md border border-offer/40 bg-offer/10 p-3 text-xs leading-relaxed text-offer">{message}</p> : null}
              </form>
              <div className="relative border-t border-border pt-5"><span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-bg-elevated px-2 text-[10px] uppercase tracking-[0.12em] text-subtle">or continue with</span><SignInButtons /></div>
              <p className="text-sm text-muted">New here? <Link to="/signup" className="font-medium text-accent hover:underline">Create an account</Link>.</p>
            </div>}>
              <p className="mt-8 text-sm text-muted">You are already signed in. <Link to="/" search={{ code: undefined, cat: undefined }} className="text-accent hover:underline">Return to the terminal</Link>.</p>
            </SignInGate>
          </div>
        </section>
      </div>
    </main>
  );
}