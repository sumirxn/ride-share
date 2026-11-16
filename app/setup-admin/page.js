"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SetupAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to verify session");
        if (data.user.role === "ADMIN") {
          window.location.replace("/admin");
          return;
        }
        setReady(true);
      })
      .catch((sessionError) => setError(sessionError.message || "Unable to verify session"));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrapToken: token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Administrator setup failed");
      router.push("/admin");
    } catch (setupError) {
      setError(setupError.message || "Administrator setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <Link className="brand" href="/">
        <span className="brand-mark">R</span>
        <span>RideShare</span>
      </Link>
      {ready && (
        <section className="search-panel setup-admin-card">
          <p className="eyebrow">ONE-TIME SETUP</p>
          <h1>Configure the first administrator</h1>
          <p className="auth-description">
            This works only when no administrator with a valid password is configured.
          </p>
          <form className="auth-form" onSubmit={submit}>
            <label className="field">
              <span>Administrator bootstrap token</span>
              <input
                type="password"
                autoComplete="off"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            {error && <p className="booking-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Configuring..." : "Set up administrator"}
            </button>
          </form>
        </section>
      )}
      {!ready && !error && <p className="booking-status">Checking your account...</p>}
      {!ready && error && <p className="error-note">{error}</p>}
    </main>
  );
}
