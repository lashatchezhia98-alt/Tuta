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
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (response.ok) { window.location.replace("/admin"); return; }
      setError(response.status === 503 ? "შესვლის სერვისი დროებით მიუწვდომელია." : response.status === 429 ? "ზედმეტად ბევრი მცდელობაა. მოგვიანებით სცადე." : "ელფოსტა ან პაროლი არასწორია, ან ანგარიში ადმინად არ არის მოწვეული.");
    } catch { setError("კავშირი ვერ შედგა. სცადე ხელახლა."); }
    finally { setLoading(false); }
  }

  return <form onSubmit={submit}>
    <label>ელფოსტა<input name="email" type="email" autoComplete="username" required /></label>
    <label>პაროლი<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <p className="admin-login-error" role="alert">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? "მოწმდება..." : "ადმინ პანელში შესვლა"}</button>
  </form>;
}
