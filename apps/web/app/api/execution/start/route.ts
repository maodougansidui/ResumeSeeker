import { NextResponse } from "next/server";

import { startExecution } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { jobIds?: string[] };
  const jobIds = body.jobIds ?? [];
  if (jobIds.length === 0) {
    return NextResponse.json({ error: "No jobs selected" }, { status: 400 });
  }

  const session = await startExecution(jobIds);
  return NextResponse.json(session);
}
