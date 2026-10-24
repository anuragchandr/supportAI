
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

import { connection } from "next/server";

type PageProps = {
  params: Promise<{
    conversationId: string;
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

export default async function ConversationDetailPage({
  params,
}: PageProps) {
  await connection();

  const user = await getCurrentUser();

  // Keep the rest of your existing page unchanged.

  if (!user) redirect("/login");

  const business = user.business;

  if (!business) notFound();

  const { conversationId } = await params;
  console.log("[Conversation detail route] Reached");

  if (!conversationId || conversationId.length > 100) {
    notFound();
  }

  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      businessId: business.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 200,
      },
      leads: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });
console.log("[Conversation lookup]", {
  found: Boolean(conversation),
  businessConfigured: Boolean(business),
});
  if (!conversation) notFound();

  // The query fetches the latest messages first. Display them
  // in chronological order for a readable transcript.
  const messages = [...conversation.messages].reverse();

  const visitorLabel = conversation.visitorId
    ? `Website visitor · ${conversation.visitorId.slice(-8)}`
    : "Workspace chat";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
          <Link
            href="/dashboard/conversations"
            className="text-sm text-zinc-500 hover:text-zinc-950"
          >
            ← Back to conversations
          </Link>

          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-zinc-500">
                {business.name}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Conversation transcript
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                {visitorLabel}
              </p>
            </div>

            <div className="text-sm text-zinc-500 sm:text-right">
              <p>{conversation._count.messages} total messages</p>
              <p className="mt-1">
                Last updated {formatDate(conversation.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        {conversation._count.messages > messages.length && (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            Showing the latest {messages.length} of{" "}
            {conversation._count.messages} messages.
          </p>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-7">
          <div className="mb-6 border-b border-zinc-100 pb-4">
            <h2 className="font-semibold">Chat history</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Messages are displayed from oldest to newest.
            </p>
          </div>

          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              This conversation does not contain any messages.
            </p>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => {
                const isCustomer = message.role === "USER";
                const isAssistant = message.role === "ASSISTANT";

                const label = isCustomer
                  ? "Customer"
                  : isAssistant
                    ? "SupportAI"
                    : "System";

                return (
                  <article
                    key={message.id}
                    className={`flex gap-3 ${
                      isCustomer ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isCustomer && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-xs font-semibold text-white">
                        {isAssistant ? "AI" : "S"}
                      </div>
                    )}

                    <div className="max-w-[90%] sm:max-w-[82%]">
                      <div
                        className={`mb-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 ${
                          isCustomer ? "justify-end" : ""
                        }`}
                      >
                        <span className="font-semibold text-zinc-700">
                          {label}
                        </span>
                        <time dateTime={message.createdAt.toISOString()}>
                          {formatDate(message.createdAt)}
                        </time>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                          isCustomer
                            ? "rounded-br-sm bg-zinc-950 text-white"
                            : "rounded-bl-sm border border-zinc-200 bg-zinc-50 text-zinc-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>

                    {isCustomer && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-xs font-semibold text-zinc-700">
                        C
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">Captured leads</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Contact submissions associated with this conversation.
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-950"
            >
              Open Lead Inbox →
            </Link>
          </div>

          {conversation.leads.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              No leads are linked to this conversation.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {conversation.leads.map((lead) => (
                <article
                  key={lead.id}
                  className="rounded-lg border border-zinc-200 p-4"
                >
                  <h3 className="font-medium">
                    {lead.name || "Unknown contact"}
                  </h3>
                  <p className="mt-1 break-words text-sm text-zinc-600">
                    {lead.email || "No email provided"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {lead.phone || "No phone provided"}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    Captured {formatDate(lead.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-zinc-500">
          This transcript is read-only. Replies, conversation assignment,
          and status management are planned for later milestones.
        </p>
      </div>
    </main>
  );
}
