import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { Table, TableStatus } from "@/app/lib/db-types";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status } = body;

    // Validate status parameter
    if (!status || !Object.entries(TableStatus).some(([_, val]) => val === status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const result = await query<Table>(
      'UPDATE "Table" SET status = $1 WHERE id = $2 RETURNING *',
      [status as TableStatus, params.id]
    );
    const table = result.rows[0];

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    return NextResponse.json(table);
  } catch (error) {
    console.error("PUT /api/tables/[id]/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
