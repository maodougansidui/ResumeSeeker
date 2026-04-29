import { NextResponse } from "next/server";

import { getCurrentExecutionTarget } from "@/lib/store";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { sessionId } = await params;
  const target = await getCurrentExecutionTarget(sessionId);
  if (!target) {
    return NextResponse.json({ error: "No queued job found for this session" }, { status: 404 });
  }

  return NextResponse.json(target);
}
