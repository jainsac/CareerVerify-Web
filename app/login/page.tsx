"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type AccountType = "EMPLOYEE" | "EMPLOYER";

export default function Login() {
  const [accountType, setAccountType] = useState<AccountType>("EMPLOYEE");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password, accountType }),
      });
      const d = await r.json();

      if (!r.ok) {
        setError(d.error || "Sign in failed");
        return;
      }

      router.push(d.role === "EMPLOYER" ? "/employer" : "/candidate");
    } catch {
      setError("Sign in could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <form className="form card" onSubmit={submit}>
        <Link className="brand" href="/">
          Career<span>Verify</span>
        </Link>

        <h1>Sign in</h1>

        <div className="field">
          <label>Account type</label>
          <div className="actions">
            <button
              type="button"
              className={accountType === "EMPLOYEE" ? "btn" : "btn alt"}
              onClick={() => {
                setAccountType("EMPLOYEE");
                setError("");
              }}
            >
              Employee
            </button>
            <button
              type="button"
              className={accountType === "EMPLOYER" ? "btn" : "btn alt"}
              onClick={() => {
                setAccountType("EMPLOYER");
                setError("");
              }}
            >
              Employer
            </button>
          </div>
        </div>

        <p className="muted">
          {accountType === "EMPLOYER"
            ? "Sign in to your employer/company workspace."
            : "Sign in to your personal CareerVerify account."}
        </p>

        <div className="field">
          <label>Email, phone number or Career ID</label>
          <input
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com / 9876543210 / CV-IND-..."
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="notice">{error}</div>}

        <button className="btn" disabled={busy}>
          {busy ? "Signing in…" : `Sign in as ${accountType === "EMPLOYER" ? "Employer" : "Employee"}`}
        </button>

        <p className="muted">
          Employee: use your personal CareerVerify email/phone/Career ID. Employer: use the employer account credentials.
        </p>
        <p className="muted"><Link href="/forgot-password">Forgot password?</Link></p>

        <p className="muted">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
