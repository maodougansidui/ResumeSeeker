import { NextResponse } from "next/server";

import { readState, saveProfile } from "@/lib/store";
import type { CandidateProfile } from "@resumeseeker/shared";

export async function GET() {
  const state = await readState();
  return NextResponse.json(state.profile);
}

export async function POST(request: Request) {
  const profile = (await request.json()) as CandidateProfile;
  const saved = await saveProfile(profile);
  return NextResponse.json(saved);
}
