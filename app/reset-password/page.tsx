"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.get("token") || "", password }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Password reset failed.");
        return;
      }
      setMessage("Password reset successfully. You can now sign in.");
      setTimeout(() => router.push("/login"), 900);
    } catch {
      setError("Password reset failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <form className="form card" onSubmit={submit}>
        <Link className="brand" href="/">Career<span>Verify</span></Link>
        <h1>Reset password</h1>
        <p className="muted">Create a new password for your CareerVerify account.</p>
        <div className="field"><label>New password</label><input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" /></div>
        <div className="field"><label>Confirm password</label><input required type="password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" /></div>
        {error && <p className="notice">{error}</p>}
        {message && <p className="notice">{message}</p>}
        <button className="btn" disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
        <p className="muted"><Link href="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}

export default function ResetPassword() {
  return <Suspense fallback={<div className="wrap"><div className="form card"><p className="muted">Loading…</p></div></div>}><ResetForm /></Suspense>;
}
