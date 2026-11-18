import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const instant = false;

export async function GET() {
  await connection();
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);

    return NextResponse.json(
      { error: "Unable to get current user." },
      { status: 500 }
    );
  }
}