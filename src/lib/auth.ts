import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

import { db } from "@/lib/db";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("supportai_token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret || jwtSecret.length < 32) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string"
    ) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        business: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
          },
        },
      },
    });

    return user;
  } catch {
    // Invalid, expired, or otherwise unverifiable token.
    return null;
  }
}