import { NextResponse, NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ documentID: string }>;
};

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
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

    const { documentID } = await context.params;

    const result = await db.document.deleteMany({
      where: {
        id: documentID,
        businessId: user.business.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Document deleted successfully.",
    });
  } catch (error) {
    console.error("Delete document error:", error);

    return NextResponse.json(
      { error: "Unable to delete document." },
      { status: 500 }
    );
  }
}