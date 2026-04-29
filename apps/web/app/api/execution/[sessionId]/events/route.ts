import { NextResponse } from "next/server";

import { appendExecutionEvent } from "@/lib/store";
import type { ExecutionEvent, ExecutionJobState } from "@resumeseeker/shared";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { sessionId } = await params;
  const body = (await request.json()) as {
    jobId: string;
    event: ExecutionEvent;
    status?: ExecutionJobState["status"];
    pauseReason?: string;
  };

  const session = await appendExecutionEvent(sessionId, body.jobId, body.event, body.status, body.pauseReason);
  if (!session) {
    return NextResponse.json({ error: "Session or job not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
