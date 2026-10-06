import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import bcrypt from "bcrypt";
import { signToken } from "@/lib/auth-server";
import { User, Role } from "@/app/lib/db-types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingResult = await query<User>(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const insertResult = await query<User>(
      'INSERT INTO "User" (name, email, "passwordHash", role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, passwordHash, Role.CASHIER]
    );
    const user = insertResult.rows[0];

    // Generate JWT token
    const token = await signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    // Return success without password
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
