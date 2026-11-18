import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ userid: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "A valid JSON body is required." },
        { status: 400 }
      );
    }

    const role = (body as Record<string, unknown>).role;
    if (role !== "ADMIN" && role !== "USER") {
      return NextResponse.json(
        { error: "Role must be either ADMIN or USER." },
        { status: 400 }
      );
    }

    const { userid } = await context.params;
    const updatedUser = await db.user.update({
      where: { id: userid },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Update user role error:", error);
    return NextResponse.json(
      { error: "Unable to update the user role." },
      { status: 500 }
    );
  }
}
