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
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(124,84,28,0.18),_transparent_32%),linear-gradient(180deg,#07111a,#0a1522_20%,#07111a)] px-4 py-6 text-fg sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-5xl overflow-hidden rounded-2xl border border-border/80 bg-bg-elevated shadow-[0_18px_60px_rgba(4,9,15,0.8)] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden border-r border-border/80 bg-bg-subtle p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(178,145,83,0.22),_transparent_30%)]" aria-hidden="true" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Oak & Ledger
            </div>
            <p className="mt-8 max-w-xs font-display text-4xl leading-tight text-fg">Read the positioning. Mark the zone. Wait for the signal.</p>
          </div>

          <div className="relative z-10 space-y-4">
            <p className="max-w-xs text-sm leading-relaxed text-muted">Your account keeps confirmed supply and demand zones separate from the market’s automatically generated context.</p>
            <div className="grid gap-2 text-sm text-fg">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg/70 px-3 py-2">
                <span className="inline-flex size-2 rounded-full bg-accent" aria-hidden="true" />
                Thursday alerts stay attached to your account
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg/70 px-3 py-2">
                <span className="inline-flex size-2 rounded-full bg-bid" aria-hidden="true" />
                Zone histories stay organized by instrument
              </div>
            </div>
          </div>
        </aside>

        <section className="flex items-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-accent lg:hidden">Oak & Ledger</p>
                <h1 className="mt-2 font-display text-3xl text-fg">Welcome back</h1>
              </div>
              <Link to="/" search={{ code: undefined, cat: undefined }} className="text-xs text-muted transition-colors hover:text-fg">Back to terminal</Link>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted">Sign in to save zones and keep your Thursday alerts tied to your account.</p>

            <SignInGate fallback={
              <div className="mt-8 space-y-6">
                <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void signInWithEmail(); }}>
                  <label className="block text-xs font-medium text-muted">
                    Email
                    <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input mt-2" autoComplete="email" placeholder="you@example.com" />
                  </label>

                  <label className="block text-xs font-medium text-muted">
                    Password
                    <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input mt-2" autoComplete="current-password" placeholder="••••••••" />
                  </label>

                  <button type="submit" disabled={busy} className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-bg transition-all duration-200 hover:translate-y-[-1px] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
                    {busy ? "Signing in..." : "Sign in"}
                  </button>

                  {message ? (
                    <p role="alert" className="rounded-md border border-offer/40 bg-offer/10 p-3 text-xs leading-relaxed text-offer">
                      {message}
                    </p>
                  ) : null}
                </form>

                <div className="relative border-t border-border pt-5">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-bg-elevated px-2 text-[10px] uppercase tracking-[0.14em] text-subtle">or continue with</span>
                  <SignInButtons />
                </div>

                <p className="text-sm text-muted">
                  New here? <Link to="/signup" className="font-medium text-accent hover:underline">Create an account</Link>.
                </p>
              </div>
            }>
              <div className="mt-8 rounded-xl border border-border bg-bg-subtle p-5 text-sm text-muted">
                You are already signed in. <Link to="/" search={{ code: undefined, cat: undefined }} className="font-medium text-accent hover:underline">Return to the terminal</Link>.
              </div>
            </SignInGate>
          </div>
        </section>
      </div>
    </main>
  );
}