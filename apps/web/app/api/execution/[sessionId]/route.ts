import { NextResponse } from "next/server";

import { getExecutionSession } from "@/lib/store";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await getExecutionSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
