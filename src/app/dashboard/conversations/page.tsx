
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

import { connection } from "next/server";

const PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

function formatDate(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pageHref(page: number, query: string) {
  const params = new URLSearchParams();

  if (query) params.set("q", query);
  params.set("page", String(page));

  return `/dashboard/conversations?${params.toString()}`;
}

export default async function ConversationsPage({
  searchParams,
}: PageProps) {
  await connection();

  const user = await getCurrentUser();

  // Keep the rest of your existing page unchanged.

  if (!user) redirect("/login");

  const business = user.business;

  if (!business) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8 text-zinc-950">
        <h1 className="text-2xl font-semibold">
          Conversation Inbox
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          This account has no business workspace configured.
        </p>
      </main>
    );
  }

  const params = await searchParams;
  const query =
    typeof params.q === "string"
      ? params.q.trim().slice(0, 100)
      : "";

  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const requestedPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 100_000)
      : 1;

  const where = {
    businessId: business.id,
    ...(query
      ? {
          OR: [
            {
              visitorId: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              messages: {
                some: {
                  content: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const total = await db.conversation.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);

  const conversations = await db.conversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          messages: true,
          leads: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-950"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-zinc-500">
                {business.name}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                Conversation Inbox
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Review customer chats and the responses from SupportAI.
              </p>
            </div>

            <p className="text-sm text-zinc-500">
              {total} {total === 1 ? "conversation" : "conversations"}
              {query ? " matching your search" : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-8">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <form
            method="GET"
            action="/dashboard/conversations"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="conversation-search" className="sr-only">
              Search conversations
            </label>

            <input
              id="conversation-search"
              name="q"
              type="search"
              defaultValue={query}
              maxLength={100}
              placeholder="Search visitor ID or message content..."
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
            />

            <button
              type="submit"
              className="rounded-lg bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Search
            </button>

            {query && (
              <Link
                href="/dashboard/conversations"
                className="rounded-lg border border-zinc-300 px-5 py-3 text-center text-sm font-medium hover:bg-zinc-50"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {conversations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">
                {query ? "No matching conversations" : "No conversations yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                {query
                  ? "Try another visitor ID or a phrase from a chat message."
                  : "Conversations will appear here after a customer or a workspace user sends a message."}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-zinc-100">
                {conversations.map((conversation) => {
                  const latest = conversation.messages[0];

                  const visitorLabel = conversation.visitorId
                    ? `Website visitor · ${conversation.visitorId.slice(-8)}`
                    : "Workspace chat";

                  const preview = latest?.content
                    ? latest.content.length > 180
                      ? `${latest.content.slice(0, 180)}…`
                      : latest.content
                    : "No messages in this conversation.";

                  const latestRole =
                    latest?.role === "USER"
                      ? "Customer"
                      : latest?.role === "ASSISTANT"
                        ? "SupportAI"
                        : latest?.role === "SYSTEM"
                          ? "System"
                          : "No messages";

                  return (
                    <Link
                      key={conversation.id}
                      href={`/dashboard/conversations/${encodeURIComponent(conversation.id)}`}
                      className="block px-5 py-5 transition hover:bg-zinc-50 sm:px-6"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold">
                              {visitorLabel}
                            </h2>
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                              {conversation._count.messages} messages
                            </span>
                            {conversation._count.leads > 0 && (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
                                {conversation._count.leads} linked{" "}
                                {conversation._count.leads === 1 ? "lead" : "leads"}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                            Latest message · {latestRole}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">
                            {preview}
                          </p>
                        </div>

                        <div className="shrink-0 text-xs text-zinc-500 sm:text-right">
                          <p>
                            Updated {formatDate(conversation.updatedAt)}
                          </p>
                          <p className="mt-2 font-medium text-zinc-800">
                            Open conversation →
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-500">
                  Page {currentPage} of {pageCount}
                </p>

                <div className="flex gap-2">
                  {currentPage > 1 ? (
                    <Link
                      href={pageHref(currentPage - 1, query)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
                      Previous
                    </span>
                  )}

                  {currentPage < pageCount ? (
                    <Link
                      href={pageHref(currentPage + 1, query)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
                      Next
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
