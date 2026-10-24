import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const business = user.business;

  const [documentCount, conversationCount, leadCount, recentLeads] =
    await Promise.all([
      business
        ? db.document.count({
            where: { businessId: business.id },
          })
        : Promise.resolve(0),

      business
        ? db.conversation.count({
            where: { businessId: business.id },
          })
        : Promise.resolve(0),

      business
        ? db.lead.count({
            where: { businessId: business.id },
          })
        : Promise.resolve(0),

      business
        ? db.lead.findMany({
            where: { businessId: business.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              name: true,
              email: true,
              source: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const firstName = user.name.split(" ")[0] || "there";

  const stats = [
    {
      label: "Knowledge base documents",
      value: documentCount,
      description: "Documents powering your AI answers",
      href: "#knowledge",
    },
    {
      label: "Conversations",
      value: conversationCount,
      description: "Customer chat sessions",
      href: "/dashboard/conversations",
    },
    {
      label: "Captured leads",
      value: leadCount,
      description: "Potential customers from your widget",
      href: "/dashboard/leads",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white p-5 md:flex">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 font-bold text-white">
              S
            </div>
            <div>
              <p className="font-semibold tracking-tight">SupportAI</p>
              <p className="text-xs text-zinc-500">Support workspace</p>
            </div>
          </Link>

          <Link
  href="/dashboard/chat"
  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100"
>
  AI Chat
</Link>

          <div className="mt-10">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Workspace
            </p>

            <nav className="space-y-1">
              <a
                href="#overview"
                className="block rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-medium"
              >
                Overview
              </a>
              <Link
                href="/dashboard/knowledge"
                className="block rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Knowledge base
              </Link>
              <Link
  href="/dashboard/conversations"
  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100"
>
  Conversations
</Link>
              <Link
  href="/dashboard/leads"
  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100"
>
  Leads
</Link>
            </nav>
          </div>

          <div className="mt-auto border-t border-zinc-200 pt-4">
            <p className="truncate px-3 text-sm font-medium">{user.name}</p>
            <p className="mb-3 truncate px-3 text-xs text-zinc-500">
              {user.email}
            </p>
            <LogoutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4 sm:px-8">
            <div>
              <p className="text-sm text-zinc-500">SupportAI workspace</p>
              <h1 className="text-lg font-semibold">Overview</h1>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-zinc-600 sm:block">
                {user.name}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="md:hidden">
                <LogoutButton />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
            <section id="overview">
              <p className="text-sm font-medium text-zinc-500">
                Your workspace
              </p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Good to see you, {firstName}.
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Here's what's happening with your customer support.
              </p>
            </section>

            {!business && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-semibold text-amber-950">
                  Your business workspace isn't configured yet
                </h3>
                <p className="mt-1 text-sm text-amber-900">
                  This account does not have a linked business. The dashboard
                  statistics will appear after its business record is set up.
                </p>
              </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map((stat) => (
                <a
                  key={stat.label}
                  href={stat.href}
                  className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm"
                >
                  <p className="text-sm text-zinc-500">{stat.label}</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {stat.description}
                  </p>
                </a>
              ))}
            </section>

            <section
              id="knowledge"
              className="rounded-xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold">Knowledge base</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Manage the information your AI assistant can use.
                  </p>
                </div>
                
                <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
                  {documentCount} documents
                  
                </span>
                <Link
  href="/dashboard/knowledge"
  className="mt-4 inline-flex items-center rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
>
  Manage documents
</Link>
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-center">
                <p className="text-sm font-medium">
                  {documentCount === 0
                    ? "Your knowledge base is empty"
                    : `${documentCount} documents added`}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Document ingestion and RAG processing are the next development
                  milestone.
                </p>
              </div>
              
            </section>

            <section
              id="conversations"
              className="rounded-xl border border-zinc-200 bg-white p-6"
            >
              <h3 className="font-semibold">Conversations</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Customer chat sessions stored for this business.
              </p>
              <p className="mt-5 text-2xl font-semibold">{conversationCount}</p>
              <p className="mt-1 text-xs text-zinc-500">Total conversations</p>
              <Link
  href="/dashboard/conversations"
  className="mt-4 inline-flex text-sm font-medium text-zinc-700 hover:text-zinc-950"
>
  View all conversations →
</Link>
            </section>

            <section
              id="leads"
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
                <div>
                  <h3 className="font-semibold">Recent leads</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    The latest potential customers captured by your workspace.
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
                  {leadCount} total
                </span>
                <Link
  href="/dashboard/leads"
  className="text-sm font-medium text-zinc-700 hover:text-zinc-950"
>
  View all leads →
</Link>
              </div>

              {recentLeads.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium">No leads yet</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Captured leads will appear here when customers submit their
                    contact details.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Source</th>
                        <th className="px-6 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {recentLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td className="px-6 py-4 font-medium">
                            {lead.name || "Unknown"}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {lead.email || "—"}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {lead.source}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-zinc-600">
                            {lead.createdAt.toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <footer className="pb-4 text-xs text-zinc-400">
              SupportAI · Customer support workspace
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
