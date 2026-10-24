
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type RegisterResponse = {
  error?: string;
  message?: string;
};

export default function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          businessName,
          websiteUrl,
          email,
          password,
        }),
      });

      const data =
        (await response.json()) as RegisterResponse;

      if (!response.ok) {
        setError(
          data.error || "Unable to create your account."
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(
        "Unable to connect to SupportAI. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Your full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          minLength={1}
          maxLength={100}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="businessName"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Business name
        </label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          autoComplete="organization"
          maxLength={150}
          required
          value={businessName}
          onChange={(event) =>
            setBusinessName(event.target.value)
          }
          placeholder="Your company or business"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          A separate workspace will be created for your business.
        </p>
      </div>

      <div>
        <label
          htmlFor="websiteUrl"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Business website{" "}
          <span className="font-normal text-zinc-400">
            (optional)
          </span>
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          autoComplete="url"
          value={websiteUrl}
          onChange={(event) =>
            setWebsiteUrl(event.target.value)
          }
          placeholder="https://example.com"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Create a password"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Use at least 8 characters.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating workspace..." : "Create account"}
      </button>

      <p className="text-center text-xs leading-5 text-zinc-400">
        Your password is hashed on the server. It is not
        stored as plain text.
      </p>
    </form>
  );
}
