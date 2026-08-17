"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    setLoading(false);
    if (response.ok) window.location.assign("/admin");
    else setError(response.status === 503 ? "ადმინის მონაცემები ჯერ არ არის კონფიგურირებული." : "ელფოსტა ან პაროლი არასწორია.");
  }

  return <form onSubmit={submit}>
    <label>ელფოსტა<input name="email" type="email" autoComplete="username" required /></label>
    <label>პაროლი<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <p className="admin-login-error" role="alert">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? "მოწმდება..." : "ადმინ პანელში შესვლა"}</button>
  </form>;
}
