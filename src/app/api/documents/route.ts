import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

import { ingestDocument } from "@/lib/rag/ingest-document";

export async function GET() {
  try {
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

    const documents = await db.document.findMany({
      where: {
        businessId: user.business.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        sourceType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("List documents error:", error);

    return NextResponse.json(
      { error: "Unable to load documents." },
      { status: 500 }
    );
  }
}


export async function POST(request: Request) {
  let documentId: string | undefined;
  let businessId: string | undefined;

  try {
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

    businessId = user.business.id;

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "A valid JSON body is required." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const title =
      typeof data.title === "string" ? data.title.trim() : "";

    const content =
      typeof data.content === "string" ? data.content.trim() : "";

    if (!title || !content) {
      return NextResponse.json(
        { error: "Document title and content are required." },
        { status: 400 }
      );
    }

    if (title.length > 150) {
      return NextResponse.json(
        { error: "Title cannot exceed 150 characters." },
        { status: 400 }
      );
    }

    if (content.length > 100_000) {
      return NextResponse.json(
        { error: "Document content cannot exceed 100,000 characters." },
        { status: 413 }
      );
    }

    const document = await db.document.create({
      data: {
        title,
        content,
        sourceType: "text",
        status: "PENDING",
        businessId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    documentId = document.id;

    const ingestion = await ingestDocument(
      document.id,
      businessId,
      content
    );

    return NextResponse.json(
      {
        message: "Document embedded and indexed successfully.",
        document: {
          ...document,
          status: "PROCESSED",
        },
        chunksCreated: ingestion.chunksCreated,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Document ingestion failed:", error);

    if (documentId && businessId) {
      try {
        await db.documentChunk.deleteMany({
          where: {
            documentId,
            document: { businessId },
          },
        });

        await db.document.updateMany({
          where: {
            id: documentId,
            businessId,
          },
          data: {
            status: "FAILED",
          },
        });
      } catch (cleanupError) {
        console.error(
          "Document failure cleanup failed:",
          cleanupError
        );
      }

      return NextResponse.json(
        {
          error:
            "The document was saved but processing failed. Check your Cloudflare configuration and usage limits, then retry ingestion.",
          documentId,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create the document." },
      { status: 500 }
    );
  }
}
