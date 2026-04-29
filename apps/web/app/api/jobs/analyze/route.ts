import { NextResponse } from "next/server";

import { addJobs, getDashboardData } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { urls?: string[] };
  const urls = (body.urls ?? []).map((url) => url.trim()).filter(Boolean);

  if (urls.length === 0) {
    return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
  }

  await addJobs(urls);
  const data = await getDashboardData();
  return NextResponse.json(data);
}
