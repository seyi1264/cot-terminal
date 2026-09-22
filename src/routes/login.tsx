import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInButtons, SignInGate } from "@/lib/auth/gates";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-12 text-fg">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent">Oak & Ledger</p>
        <h1 className="mt-2 font-display text-3xl">Sign in to save zones</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your saved zones and Thursday alerts are tied to your account.
        </p>
        <SignInGate fallback={<div className="mt-6"><SignInButtons /></div>}>
          <p className="mt-6 text-sm text-muted">You are already signed in. <Link to="/" search={{ code: undefined, cat: undefined }} className="text-accent hover:underline">Return to the terminal</Link>.</p>
        </SignInGate>
        <Link to="/" search={{ code: undefined, cat: undefined }} className="mt-6 inline-block text-xs text-muted hover:text-fg">Back to terminal</Link>
      </section>
    </main>
  );
}