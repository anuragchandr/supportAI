
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

type ChatSource = {
  reference: number;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  similarity: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

type ChatResponse = {
  answer?: string;
  conversationId?: string;
  sources?: ChatSource[];
  error?: string;
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your SupportAI assistant. Ask me a question about your business knowledge base, and I'll look for a relevant answer.",
};

export default function ChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    welcomeMessage,
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(
    null
  );
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState("");

  const [userName, setUserName] = useState("");
  const [businessName, setBusinessName] = useState("");

  const verifySession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to verify your session.");
      }

      const data = await response.json();

      setUserName(data.user?.name ?? "");
      setBusinessName(data.user?.business?.name ?? "");
      setAuthChecking(false);
    } catch {
      setError(
        "Unable to verify your session. Check your connection and refresh."
      );
      setAuthChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void verifySession();
  }, [verifySession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, pendingQuestion]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = input.trim();

    if (!question || sending || authChecking) {
      return;
    }

    setError("");
    setInput("");
    setPendingQuestion(question);
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          ...(conversationId ? { conversationId } : {}),
        }),
      });

      const data = (await response.json()) as ChatResponse;

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to generate an answer."
        );
      }

      if (!data.answer || !data.conversationId) {
        throw new Error("The server returned an incomplete response.");
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        sources: data.sources ?? [],
      };

      setMessages((current) => [
        ...current,
        userMessage,
        assistantMessage,
      ]);

      setConversationId(data.conversationId);
    } catch (err) {
      setInput(question);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setPendingQuestion("");
      setSending(false);
    }
  }

  function startNewChat() {
    if (sending) return;

    setMessages([welcomeMessage]);
    setConversationId(null);
    setInput("");
    setError("");
    setPendingQuestion("");
  }

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">
          Verifying your session...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 font-bold text-white"
              aria-label="Back to dashboard"
            >
              S
            </Link>
            <Link
  href="/dashboard/widget"
  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100"
>
  Website widget
</Link>
            <div>
              <h1 className="font-semibold">SupportAI</h1>
              <p className="text-xs text-zinc-500">
                {businessName || "Customer support assistant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={startNewChat}
              disabled={sending}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
            >
              + New chat
            </button>

            <Link
              href="/dashboard"
              className="hidden text-sm text-zinc-600 hover:text-zinc-950 sm:block"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section
          className="flex flex-1 flex-col"
          aria-label="AI customer support chat"
        >
          <div className="border-b border-zinc-200 bg-white/80 px-5 py-5 sm:px-8">
            <p className="text-sm font-medium text-zinc-500">
              {userName ? `Signed in as ${userName}` : "AI assistant"}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Ask your business knowledge base
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Answers are generated using relevant documents from your
              workspace.
            </p>
          </div>

          <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-semibold text-white">
                      S
                    </div>
                  )}

                  <div className="max-w-[88%] sm:max-w-[80%]">
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                        message.role === "user"
                          ? "rounded-br-sm bg-zinc-950 text-white"
                          : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>

                    {message.role === "assistant" &&
                      message.sources &&
                      message.sources.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Sources
                          </p>

                          {message.sources.map((source) => (
                            <div
                              key={`${source.documentId}-${source.chunkIndex}`}
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-3"
                            >
                              <div className="flex items-start gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold">
                                  {source.reference}
                                </span>

                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium">
                                    {source.documentTitle}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    Chunk {source.chunkIndex + 1}
                                    {" · "}
                                    {Number.isFinite(source.similarity)
                                      ? `${Math.round(
                                          source.similarity * 100
                                        )}% similarity`
                                      : "Retrieved passage"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-semibold">
                      {userName.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </article>
              ))}

              {pendingQuestion && (
                <article className="flex justify-end gap-3">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-zinc-950 px-4 py-3 text-sm leading-7 text-white">
                    {pendingQuestion}
                  </div>
                </article>
              )}

              {sending && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-3 text-sm text-zinc-500"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 font-semibold text-white">
                    S
                  </div>
                  Searching your documents and generating an answer...
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <p>{error}</p>
                  <button
                    onClick={() => setError("")}
                    className="mt-2 font-medium underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-zinc-200 bg-white px-4 py-4 sm:px-8">
            <form
              onSubmit={sendMessage}
              className="mx-auto max-w-3xl"
            >
              <div className="flex items-end gap-3 rounded-2xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:border-zinc-500">
                <label htmlFor="chat-message" className="sr-only">
                  Your question
                </label>

                <textarea
                  id="chat-message"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={1000}
                  rows={2}
                  placeholder="Ask about returns, products, policies..."
                  disabled={sending}
                  className="max-h-40 min-h-12 flex-1 resize-y bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-zinc-400 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>

              <p className="mt-2 text-center text-xs text-zinc-400">
                Answers are based on retrieved business documents and may
                require verification.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
