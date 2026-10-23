import { NextResponse } from "next/server";

import { db } from "@/lib/db";

const RATE_LIMIT_PER_MINUTE = 20;

function jsonWithCors(
  body: unknown,
  status: number,
  origin: string
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
  });
}

async function authorizeWidget(request: Request) {
  const url = new URL(request.url);
  const widgetKey = url.searchParams.get("key");
  const originHeader = request.headers.get("origin");

  if (!widgetKey || !originHeader || originHeader === "null") {
    return null;
  }

  let origin: string;

  try {
    const parsedOrigin = new URL(originHeader);

    if (parsedOrigin.origin !== originHeader) {
      return null;
    }

    origin = parsedOrigin.origin;
  } catch {
    return null;
  }

  const business = await db.business.findUnique({
    where: { widgetKey },
    select: {
      id: true,
      allowedOrigins: true,
    },
  });

  if (!business || !business.allowedOrigins.includes(origin)) {
    return null;
  }

  return { business, origin };
}

async function incrementRateLimit(businessId: string) {
  const rows = await db.$queryRaw<
    Array<{ requestCount: number }>
  >`
    INSERT INTO public.widget_rate_buckets AS bucket
      ("businessId", "windowStart", "requestCount", "updatedAt")
    VALUES
      (${businessId}, NOW(), 1, NOW())
    ON CONFLICT ("businessId") DO UPDATE
    SET
      "requestCount" = CASE
        WHEN bucket."windowStart" <= NOW() - INTERVAL '1 minute'
          THEN 1
        ELSE bucket."requestCount" + 1
      END,
      "windowStart" = CASE
        WHEN bucket."windowStart" <= NOW() - INTERVAL '1 minute'
          THEN NOW()
        ELSE bucket."windowStart"
      END,
      "updatedAt" = NOW()
    RETURNING "requestCount"
  `;

  return rows[0]?.requestCount ?? 0;
}

export async function OPTIONS(request: Request) {
  try {
    const authorized = await authorizeWidget(request);

    if (!authorized) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": authorized.origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorized = await authorizeWidget(request);

    if (!authorized) {
      return NextResponse.json(
        { error: "Widget is not authorized for this origin." },
        { status: 403 }
      );
    }

    const { business, origin } = authorized;

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonWithCors(
        { error: "A valid JSON body is required." },
        400,
        origin
      );
    }

    const data = body as Record<string, unknown>;

    const name =
      typeof data.name === "string" ? data.name.trim() : "";

    const email =
      typeof data.email === "string"
        ? data.email.trim().toLowerCase()
        : "";

    const phone =
      typeof data.phone === "string" ? data.phone.trim() : "";

    const message =
      typeof data.message === "string" ? data.message.trim() : "";

    const visitorId =
      typeof data.visitorId === "string" ? data.visitorId : "";

    const conversationId =
      typeof data.conversationId === "string"
        ? data.conversationId.trim()
        : "";

    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(visitorId)) {
      return jsonWithCors(
        { error: "Invalid visitor ID." },
        400,
        origin
      );
    }

    if (!name || name.length > 100) {
      return jsonWithCors(
        { error: "Name is required and must not exceed 100 characters." },
        400,
        origin
      );
    }

    if (!email && !phone) {
      return jsonWithCors(
        { error: "Provide an email address or phone number." },
        400,
        origin
      );
    }

    if (
      email &&
      (email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      return jsonWithCors(
        { error: "Enter a valid email address." },
        400,
        origin
      );
    }

    if (phone) {
      const digits = phone.replace(/\D/g, "");

      if (
        phone.length > 30 ||
        digits.length < 7 ||
        digits.length > 15 ||
        !/^[+\d().\s-]+$/.test(phone)
      ) {
        return jsonWithCors(
          { error: "Enter a valid phone number." },
          400,
          origin
        );
      }
    }

    if (message.length > 2000) {
      return jsonWithCors(
        { error: "Message cannot exceed 2000 characters." },
        400,
        origin
      );
    }

    if (
      data.conversationId !== undefined &&
      data.conversationId !== null &&
      typeof data.conversationId !== "string"
    ) {
      return jsonWithCors(
        { error: "Invalid conversation ID." },
        400,
        origin
      );
    }

    if (conversationId.length > 100) {
      return jsonWithCors(
        { error: "Invalid conversation ID." },
        400,
        origin
      );
    }

    // A supplied conversation must belong to this business and visitor.
    if (conversationId) {
      const conversation = await db.conversation.findFirst({
        where: {
          id: conversationId,
          businessId: business.id,
          visitorId,
        },
        select: { id: true },
      });

      if (!conversation) {
        return jsonWithCors(
          { error: "Conversation not found." },
          404,
          origin
        );
      }
    }

    // Reuse the database-backed per-business rate limit.
    const requestCount = await incrementRateLimit(business.id);

    if (requestCount > RATE_LIMIT_PER_MINUTE) {
      return jsonWithCors(
        { error: "Too many requests. Please try again shortly." },
        429,
        origin
      );
    }

    const lead = await db.lead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        message: message || null,
        source: "website_widget",
        businessId: business.id,
        conversationId: conversationId || null,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return jsonWithCors(
      {
        message: "Thanks! Your contact details were submitted successfully.",
        leadId: lead.id,
        createdAt: lead.createdAt,
      },
      201,
      origin
    );
  } catch (error) {
    console.error(
      "Widget lead submission failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to submit your details right now." },
      { status: 500 }
    );
  }
}