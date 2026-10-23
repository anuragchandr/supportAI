
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    // 1. Read and validate the request body.
    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "A valid JSON request body is required." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const name =
      typeof data.name === "string" ? data.name.trim() : "";

    const email =
      typeof data.email === "string"
        ? data.email.trim().toLowerCase()
        : "";

    const password =
      typeof data.password === "string" ? data.password : "";

    const businessName =
      typeof data.businessName === "string"
        ? data.businessName.trim()
        : "";

    const websiteUrl =
      typeof data.websiteUrl === "string"
        ? data.websiteUrl.trim()
        : "";

    if (!name || !businessName || !email || !password) {
      return NextResponse.json(
        {
          error:
            "Name, email, password, and business name are required.",
        },
        { status: 400 }
      );
    }

    if (name.length > 100 || businessName.length > 150) {
      return NextResponse.json(
        { error: "Name or business name is too long." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 72) {
      return NextResponse.json(
        { error: "Password must be between 8 and 72 characters." },
        { status: 400 }
      );
    }

    if (websiteUrl) {
      try {
        const website = new URL(websiteUrl);

        if (!["http:", "https:"].includes(website.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "Enter a valid website URL." },
          { status: 400 }
        );
      }
    }

    // 2. Ensure the server has its signing secret.
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret.length < 32) {
      console.error("JWT_SECRET is missing or too short.");

      return NextResponse.json(
        { error: "Server authentication is not configured." },
        { status: 500 }
      );
    }

    // 3. Check whether the email is already registered.
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // 4. Never store the original password.
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Create the user and their business together.
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        business: {
          create: {
            name: businessName,
            websiteUrl: websiteUrl || null,
          },
        },
      },
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

    // 6. Sign a seven-day JWT.
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    // 7. Return safe user data and set an HTTP-only cookie.
    const response = NextResponse.json(
      {
        message: "Account created successfully.",
        user,
      },
      { status: 201 }
    );

    response.cookies.set("supportai_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("Registration error:", error);

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
