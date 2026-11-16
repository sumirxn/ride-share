"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthForm({ mode }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "PASSENGER",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return;
        const { user } = await response.json();
        window.location.replace(
          user.role === "ADMIN" ? "/admin" : user.role === "DRIVER" ? "/driver" : "/"
        );
      })
      .catch((sessionError) => {
        setError(sessionError.message || "Unable to verify your current session");
      });
  }, []);

  function handleChange(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Authentication failed");
      router.push(
        data.user.role === "ADMIN"
          ? "/admin"
          : data.user.role === "DRIVER"
            ? "/driver"
            : "/"
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to complete your request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">R</span>
        <span>RideShare</span>
      </Link>
      <section className="auth-card">
        <p className="eyebrow">{isRegister ? "JOIN RIDESHARE" : "WELCOME BACK"}</p>
        <h1>{isRegister ? "Create your account" : "Sign in"}</h1>
        <p className="auth-description">
          {isRegister
            ? "Register as a rider. Administrator access is granted separately."
            : "Sign in to search, offer and book rides."}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <label className="field">
                <span>Name</span>
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  value={values.name}
                  onChange={handleChange}
                />
              </label>
              <label className="field">
                <span>Phone (optional)</span>
                <input
                  name="phone"
                  autoComplete="tel"
                  maxLength={20}
                  value={values.phone}
                  onChange={handleChange}
                />
              </label>
              <label className="field">
                <span>Account type</span>
                <select name="role" value={values.role} onChange={handleChange}>
                  <option value="PASSENGER">Passenger</option>
                  <option value="DRIVER">Driver</option>
                </select>
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              maxLength={255}
              required
              value={values.email}
              onChange={handleChange}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={8}
              maxLength={72}
              required
              value={values.password}
              onChange={handleChange}
            />
          </label>
          {error && <p className="booking-error" role="alert">{error}</p>}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? "Already registered?" : "New to RideShare?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="auth-switch">
          <Link href="/setup-admin">Set up the first administrator</Link>
        </p>
      </section>
    </main>
  );
}
