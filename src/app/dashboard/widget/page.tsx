
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WidgetSettings = {
  businessName?: string;
  widgetKey: string | null;
  allowedOrigins: string[];
  error?: string;
  message?: string;
};

export default function WidgetSettingsPage() {
  const [settings, setSettings] = useState<WidgetSettings>({
    widgetKey: null,
    allowedOrigins: [],
  });

  const [originsText, setOriginsText] = useState("");
  const [appOrigin, setAppOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setAppOrigin(window.location.origin);

    async function loadSettings() {
      try {
        const response = await fetch("/api/widget/settings", {
          credentials: "same-origin",
          cache: "no-store",
        });

        const data = (await response.json()) as WidgetSettings;

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Unable to load settings.");
        }

        setSettings(data);
        setOriginsText(data.allowedOrigins.join("\n"));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load widget settings."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  async function saveSettings(rotateKey: boolean) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const allowedOrigins = originsText
        .split(/[\n,]/)
        .map((origin) => origin.trim())
        .filter(Boolean);

      const response = await fetch("/api/widget/settings", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowedOrigins,
          rotateKey,
        }),
      });

      const data = (await response.json()) as WidgetSettings;

      if (!response.ok) {
        throw new Error(data.error || "Unable to save settings.");
      }

      setSettings(data);
      setOriginsText(data.allowedOrigins.join("\n"));
      setNotice(data.message || "Settings saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save widget settings."
      );
    } finally {
      setSaving(false);
    }
  }

  const embedSnippet = settings.widgetKey
    ? `<script src="${appOrigin}/supportai-widget.js" data-widget-key="${settings.widgetKey}" defer></script>`
    : "";

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setNotice("Embed snippet copied.");
      setError("");
    } catch {
      setError("Copy failed. Select and copy the snippet manually.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8">
        <p className="text-sm text-zinc-500">
          Loading widget settings...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-4xl px-5 py-6">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-950"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Website widget
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Install your SupportAI assistant on a business website.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold">Allowed website origins</h2>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Enter one origin per line. Use the scheme and domain, including
            the port for local development. Do not include a page path.
          </p>

          <label
            htmlFor="origins"
            className="mb-2 mt-5 block text-sm font-medium"
          >
            Website origins
          </label>

          <textarea
            id="origins"
            rows={5}
            value={originsText}
            onChange={(event) => setOriginsText(event.target.value)}
            placeholder={"https://yourbusiness.com\nhttp://localhost:3000"}
            className="w-full rounded-lg border border-zinc-300 px-3 py-3 font-mono text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveSettings(false)}
              disabled={saving}
              className="rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save origins"}
            </button>

            <button
              type="button"
              onClick={() => {
                const label = settings.widgetKey
                  ? "Rotating the widget key will invalidate the previous embed snippet. Continue?"
                  : "Generate a widget key for this business?";

                if (window.confirm(label)) {
                  void saveSettings(true);
                }
              }}
              disabled={saving}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : settings.widgetKey
                  ? "Rotate widget key"
                  : "Generate widget key"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold">Embed snippet</h2>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Add this script to your website HTML, ideally immediately
            before the closing body tag. Keep the key associated with
            this business.
          </p>

          {settings.widgetKey ? (
            <>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
                {embedSnippet}
              </pre>

              <button
                type="button"
                onClick={() => void copySnippet()}
                className="mt-4 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100"
              >
                Copy embed snippet
              </button>
            </>
          ) : (
            <p className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
              Save your permitted website origins, then generate a widget key
              to receive your embed snippet.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold">Before publishing</h2>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Only add websites you control or are authorized to configure.
            The key identifies your business but is visible in the embed
            code. Origin validation and server-side rate limits are
            additional safeguards, not a replacement for abuse monitoring.
          </p>
        </section>
      </div>
    </main>
  );
}
