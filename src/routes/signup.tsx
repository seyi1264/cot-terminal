import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createAccount() {
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) setMessage(result.error.message ?? "Account creation failed.");
      else await navigate({ to: "/", search: { code: undefined, cat: undefined } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account creation failed. Check the account database configuration.");
    }
    setBusy(false);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-12 text-fg">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent">Oak & Ledger</p>
        <h1 className="mt-2 font-display text-3xl">Create your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Save supply and demand zones and receive alerts for your own market plans.</p>
        <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void createAccount(); }}>
          <label className="block text-xs text-muted">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="input mt-1" autoComplete="name" /></label>
          <label className="block text-xs text-muted">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input mt-1" autoComplete="email" /></label>
          <label className="block text-xs text-muted">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input mt-1" autoComplete="new-password" /></label>
          <button type="submit" disabled={busy} className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-60">{busy ? "Creating account..." : "Create account"}</button>
          {message ? <p className="text-xs text-offer">{message}</p> : null}
        </form>
        <p className="mt-5 text-xs text-muted">Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>.</p>
        <Link to="/" search={{ code: undefined, cat: undefined }} className="mt-6 inline-block text-xs text-muted hover:text-fg">Back to terminal</Link>
      </section>
    </main>
  );
}