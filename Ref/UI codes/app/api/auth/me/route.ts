import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth-server";
import { User } from "@/app/lib/db-types";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing token" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    
    // Verify JWT
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      );
    }

    // Retrieve full user from database
    const result = await query<User>(
      'SELECT id, name, email, role, "createdAt" FROM "User" WHERE id = $1',
      [decoded.userId]
    );
    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: User not found" },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Me endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
