import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";

import Link from "next/link";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Welcome to SupportAI
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in to manage your customer support workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <LoginForm />
          <p className="mt-5 text-center text-sm text-zinc-600">
  New to SupportAI?{" "}
  <Link
    href="/register"
    className="font-semibold text-zinc-950 underline underline-offset-4"
  >
    Create an account
  </Link>
</p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          AI-powered customer support and lead capture
        </p>
      </div>
    </main>
  );
}