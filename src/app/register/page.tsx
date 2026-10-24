
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  await connection();

  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-lg font-bold text-white">
            S
          </span>
          <span className="text-xl font-semibold tracking-tight text-zinc-950">
            SupportAI
          </span>
        </Link>

        <div className="mb-7 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Create your workspace
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Set up your business and start building a
            knowledge-based support assistant.
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <RegisterForm />
        </section>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-zinc-950 underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-5 text-center text-xs leading-5 text-zinc-400">
          Create an account to manage your business knowledge,
          website assistant, conversations, and captured leads.
        </p>
      </div>
    </main>
  );
}
