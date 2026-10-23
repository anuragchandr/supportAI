
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type DocumentItem = {
  id: string;
  title: string;
  sourceType: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  message?: string;
  error?: string;
  documents?: DocumentItem[];
  document?: DocumentItem;
};

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/documents", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load documents.");
      }

      setDocuments(data.documents ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load documents."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ title, content }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to save document.");
      }

      setTitle("");
      setContent("");
      setNotice(data.message || "Document saved successfully.");

      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save document."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(documentId: string) {
    const confirmed = window.confirm(
      "Delete this document? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeletingId(documentId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete document.");
      }

      setDocuments((currentDocuments) =>
        currentDocuments.filter((item) => item.id !== documentId)
      );

      setNotice(data.message || "Document deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
    }).format(new Date(date));
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-950"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Knowledge base
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage the information your AI assistant will use.
            </p>
          </div>

          <div className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600">
            {documents.length} documents
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="h-fit rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Add a document</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Start with FAQs, return policies, product details, or
            information about your business.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="document-title"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                Document title
              </label>
              <input
                id="document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={150}
                required
                placeholder="e.g. Returns and Refunds"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label
                htmlFor="document-content"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                Document content
              </label>
              <textarea
                id="document-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={100000}
                required
                rows={12}
                placeholder="Write or paste your business information here..."
                className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-3 text-sm leading-6 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
              <p className="mt-1 text-right text-xs text-zinc-400">
                {content.length.toLocaleString("en-IN")} / 100,000 characters
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

            {notice && (
              <p
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving document..." : "Save document"}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Saved documents</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Documents belonging to your current business.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
              <h3 className="font-medium">No documents yet</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Add your first document to start building your business
                knowledge base.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-xl border border-zinc-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words font-medium">
                        {document.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Added {formatDate(document.createdAt)}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {document.status}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <span className="text-xs text-zinc-500">
                      Text document
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleDelete(document.id)}
                      disabled={deletingId === document.id}
                      className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deletingId === document.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
