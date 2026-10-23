import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve-context";

export async function POST(request: Request) {
  try {
    // Require a valid SupportAI session.
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!user.business) {
      return NextResponse.json(
        { error: "No business workspace is linked to this account." },
        { status: 409 }
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "A valid JSON body is required." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const question =
      typeof data.question === "string"
        ? data.question.trim()
        : "";

    if (!question) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Question cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    const matches = await retrieveRelevantChunks(
      question,
      user.business.id
    );

    return NextResponse.json({
      question,
      resultCount: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Semantic retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to search the knowledge base." },
      { status: 500 }
    );
  }
}