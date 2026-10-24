
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 25;

type LeadsPageProps = {
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

  return `/dashboard/leads?${params.toString()}`;
}

export default async function LeadsPage({
  searchParams,
}: LeadsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const business = user.business;

  if (!business) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8 text-zinc-950">
        <h1 className="text-2xl font-semibold">
          Lead Inbox
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          This account does not have a business workspace
          configured yet.
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
              name: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              phone: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              message: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const total = await db.lead.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      message: true,
      source: true,
      conversationId: true,
      createdAt: true,
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
                Lead Inbox
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Review potential customers captured by your
                SupportAI widget.
              </p>
            </div>

            <p className="text-sm text-zinc-500">
              {total} {total === 1 ? "lead" : "leads"}
              {query ? " matching your search" : " in total"}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-8">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <form
            method="GET"
            action="/dashboard/leads"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label
              htmlFor="lead-search"
              className="sr-only"
            >
              Search leads
            </label>

            <input
              id="lead-search"
              name="q"
              type="search"
              defaultValue={query}
              maxLength={100}
              placeholder="Search by name, email, phone, or message..."
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
            />

            <button
              type="submit"
              className="rounded-lg bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Search leads
            </button>

            {query && (
              <Link
                href="/dashboard/leads"
                className="rounded-lg border border-zinc-300 px-5 py-3 text-center text-sm font-medium hover:bg-zinc-50"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {leads.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">
                {query ? "No matching leads" : "No leads yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                {query
                  ? "Try another name, email address, phone number, or search term."
                  : "When a visitor submits their contact details through your website widget, the lead will appear here."}
              </p>
              {query && (
                <Link
                  href="/dashboard/leads"
                  className="mt-5 inline-flex rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white"
                >
                  View all leads
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">Contact</th>
                      <th className="px-5 py-4 font-medium">Message</th>
                      <th className="px-5 py-4 font-medium">Source</th>
                      <th className="px-5 py-4 font-medium">Conversation</th>
                      <th className="px-5 py-4 font-medium">Captured</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="align-top hover:bg-zinc-50"
                      >
                        <td className="max-w-xs px-5 py-4">
                          <p className="font-medium">
                            {lead.name || "Unknown"}
                          </p>

                          <p className="mt-1 break-words text-zinc-600">
                            {lead.email || "No email"}
                          </p>

                          <p className="mt-1 text-zinc-500">
                            {lead.phone || "No phone"}
                          </p>
                        </td>

                        <td className="max-w-sm whitespace-normal break-words px-5 py-4 text-zinc-600">
                          {lead.message || "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-zinc-600">
                          {lead.source.replaceAll("_", " ")}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          {lead.conversationId ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                              Chat linked
                            </span>
                          ) : (
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                              Form only
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-zinc-600">
                          {formatDate(lead.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

        <p className="text-xs leading-5 text-zinc-500">
          Lead data is restricted to your business workspace.
          Lead statuses and internal notes will be added in a
          later milestone.
        </p>
      </div>
    </main>
  );
}
