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
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-12 text-fg">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent">Oak & Ledger</p>
        <h1 className="mt-2 font-display text-3xl">Sign in to save zones</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your saved zones and Thursday alerts are tied to your account.
        </p>
        <SignInGate fallback={<div className="mt-6 space-y-6">
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void signInWithEmail(); }}>
            <label className="block text-xs text-muted">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input mt-1" autoComplete="email" /></label>
            <label className="block text-xs text-muted">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input mt-1" autoComplete="current-password" /></label>
            <button type="submit" disabled={busy} className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-60">{busy ? "Signing in..." : "Sign in"}</button>
            {message ? <p className="text-xs text-offer">{message}</p> : null}
          </form>
          <div className="border-t border-border pt-5"><p className="mb-2 text-xs text-muted">Or continue with a provider</p><SignInButtons /></div>
          <p className="text-xs text-muted">New here? <Link to="/signup" className="text-accent hover:underline">Create an account</Link>.</p>
        </div>}>
          <p className="mt-6 text-sm text-muted">You are already signed in. <Link to="/" search={{ code: undefined, cat: undefined }} className="text-accent hover:underline">Return to the terminal</Link>.</p>
        </SignInGate>
        <Link to="/" search={{ code: undefined, cat: undefined }} className="mt-6 inline-block text-xs text-muted hover:text-fg">Back to terminal</Link>
      </section>
    </main>
  );
}