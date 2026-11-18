
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ documentID: string }>;
};

export async function DELETE(
  _request: Request,
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

    // Check whether the user has an associated business
    if (!user.business) {
      return NextResponse.json(
        { error: "Business account not found." },
        { status: 403 }
      );
    }

    const { documentID } = await context.params;

    if (!documentID) {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

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
      success: true,
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
