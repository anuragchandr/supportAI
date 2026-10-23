import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function normalizeOrigins(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) {
    return null;
  }

  const origins: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    const input = item.trim();

    if (!input) {
      continue;
    }

    let url: URL;

    try {
      url = new URL(input);
    } catch {
      return null;
    }

    const isLocalHost = [
      "localhost",
      "127.0.0.1",
      "[::1]",
    ].includes(url.hostname);

    const isSecure =
      url.protocol === "https:" ||
      (url.protocol === "http:" && isLocalHost);

    if (
      !isSecure ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    origins.push(url.origin);
  }

  return [...new Set(origins)];
}

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

    const business = await db.business.findUnique({
      where: { id: user.business.id },
      select: {
        id: true,
        name: true,
        widgetKey: true,
        allowedOrigins: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      businessName: business.name,
      widgetKey: business.widgetKey,
      allowedOrigins: business.allowedOrigins,
    });
  } catch (error) {
    console.error("Widget settings read failed:", error);

    return NextResponse.json(
      { error: "Unable to load widget settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "A valid JSON body is required." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    if (
      data.rotateKey !== undefined &&
      typeof data.rotateKey !== "boolean"
    ) {
      return NextResponse.json(
        { error: "rotateKey must be a boolean." },
        { status: 400 }
      );
    }

    const allowedOrigins = normalizeOrigins(data.allowedOrigins);

    if (allowedOrigins === null) {
      return NextResponse.json(
        {
          error:
            "Provide up to 20 valid HTTPS website origins. HTTP is allowed only for localhost development.",
        },
        { status: 400 }
      );
    }

    const business = await db.business.findUnique({
      where: { id: user.business.id },
      select: { widgetKey: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    const shouldRotateKey =
      data.rotateKey === true || !business.widgetKey;

    const widgetKey = shouldRotateKey
      ? randomBytes(32).toString("hex")
      : business.widgetKey!;

    const updated = await db.business.update({
      where: { id: user.business.id },
      data: {
        widgetKey,
        allowedOrigins,
      },
      select: {
        name: true,
        widgetKey: true,
        allowedOrigins: true,
      },
    });

    return NextResponse.json({
      message: shouldRotateKey
        ? "Widget key generated successfully."
        : "Widget settings saved successfully.",
      ...updated,
    });
  } catch (error) {
    console.error("Widget settings update failed:", error);

    return NextResponse.json(
      { error: "Unable to update widget settings." },
      { status: 500 }
    );
  }
}