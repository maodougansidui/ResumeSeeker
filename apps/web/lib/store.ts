import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildFieldResolutions,
  detectAtsType,
  getStandardFieldsForAts,
  type ApplicationDraft,
  type CandidateProfile,
  type ExecutionEvent,
  type ExecutionJobState,
  type ExecutionSession,
  type JobStatus,
  type JobTarget,
  type PersistedState,
} from "@resumeseeker/shared";

const dataDir = path.resolve(process.cwd(), "../../data");
const seedPath = path.join(dataDir, "seed.json");
const statePath = path.join(dataDir, "state.json");

async function ensureStateFile(): Promise<void> {
  try {
    await fs.access(statePath);
  } catch {
    const seed = await fs.readFile(seedPath, "utf8");
    await fs.writeFile(statePath, seed, "utf8");
  }
}

export async function readState(): Promise<PersistedState> {
  await ensureStateFile();
  const raw = await fs.readFile(statePath, "utf8");
  return JSON.parse(raw) as PersistedState;
}

export async function writeState(nextState: PersistedState): Promise<void> {
  await fs.writeFile(statePath, JSON.stringify(nextState, null, 2), "utf8");
}

export async function saveProfile(profile: CandidateProfile): Promise<CandidateProfile> {
  const state = await readState();
  state.profile = profile;
  await writeState(state);
  return state.profile;
}

export function generateDraft(job: JobTarget, profile: CandidateProfile): ApplicationDraft {
  const fields = getStandardFieldsForAts(job.atsType);
  const resolutions = buildFieldResolutions(fields, profile);
  const missingFields = resolutions.filter((resolution) => resolution.status !== "filled").map((resolution) => resolution.key);
  const confidenceFlags = [
    ...new Set(
      resolutions
        .filter((resolution) => resolution.status !== "filled")
        .map((resolution) => `${resolution.label}: ${resolution.reason ?? "Needs review"}`),
    ),
  ];

  const status: JobStatus =
    job.atsType === "unsupported"
      ? "unsupported"
      : missingFields.some((key) => key === "unknown")
        ? "manual_only"
        : missingFields.length > 0
          ? "needs_review"
          : "ready";

  return {
    jobId: job.id,
    atsType: job.atsType,
    status,
    fields,
    resolutions,
    missingFields,
    confidenceFlags,
    generatedAt: new Date().toISOString(),
  };
}

function normalizeJobFromUrl(url: string): Pick<JobTarget, "company" | "role" | "location"> {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const companySegment = segments[0] ?? parsed.hostname.split(".")[0];
    const roleSegment = segments.at(-1) ?? "unknown-role";

    return {
      company: slugToTitle(companySegment.replace("jobs", "").replace("boards", "")) || "Unknown Company",
      role: slugToTitle(roleSegment.replace(/[0-9]/g, "")) || "Unknown Role",
      location: "Unknown / Review needed",
    };
  } catch {
    return {
      company: "Unknown Company",
      role: "Unknown Role",
      location: "Unknown / Review needed",
    };
  }
}

function slugToTitle(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function addJobs(urls: string[]): Promise<JobTarget[]> {
  const state = await readState();
  const createdJobs = urls.map((url) => {
    const metadata = normalizeJobFromUrl(url);
    const atsType = detectAtsType(url);
    const baseJob: JobTarget = {
      id: `job_${Math.random().toString(36).slice(2, 10)}`,
      url,
      company: metadata.company,
      role: metadata.role,
      location: metadata.location,
      atsType,
      status: atsType === "unsupported" ? "unsupported" : "draft",
      lastAnalyzedAt: new Date().toISOString(),
    };
    const draft = generateDraft(baseJob, state.profile);
    return { ...baseJob, status: draft.status };
  });

  state.jobs = [...createdJobs, ...state.jobs];
  await writeState(state);
  return createdJobs;
}

export async function getDashboardData() {
  const state = await readState();
  const drafts = state.jobs.map((job) => generateDraft(job, state.profile));

  return {
    profile: state.profile,
    jobs: state.jobs.map((job) => {
      const draft = drafts.find((item) => item.jobId === job.id);
      return { ...job, status: draft?.status ?? job.status };
    }),
    drafts,
    executionSessions: state.executionSessions,
  };
}

export async function startExecution(jobIds: string[]): Promise<ExecutionSession> {
  const state = await readState();
  const selectedJobs = state.jobs.filter((job) => jobIds.includes(job.id));
  const session: ExecutionSession = {
    id: `session_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    status: "pending_confirmation",
    jobIds: selectedJobs.map((job) => job.id),
    jobs: selectedJobs.map<ExecutionJobState>((job) => ({
      jobId: job.id,
      url: job.url,
      atsType: job.atsType,
      status: "queued",
      events: [
        {
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Session created and awaiting extension confirmation.",
        },
      ],
    })),
  };

  state.executionSessions.unshift(session);
  await writeState(state);
  return session;
}

export async function getExecutionSession(sessionId: string): Promise<ExecutionSession | undefined> {
  const state = await readState();
  return state.executionSessions.find((session) => session.id === sessionId);
}

export async function appendExecutionEvent(
  sessionId: string,
  jobId: string,
  event: ExecutionEvent,
  status?: ExecutionJobState["status"],
  pauseReason?: string,
): Promise<ExecutionSession | undefined> {
  const state = await readState();
  const session = state.executionSessions.find((item) => item.id === sessionId);
  if (!session) return undefined;

  const job = session.jobs.find((item) => item.jobId === jobId);
  if (!job) return undefined;

  job.events.unshift(event);
  if (status) job.status = status;
  if (pauseReason) job.pauseReason = pauseReason;

  const hasRunning = session.jobs.some((item) => item.status === "running");
  const hasPaused = session.jobs.some((item) => item.status === "paused");
  const allCompleted = session.jobs.every((item) => item.status === "completed");

  session.status = allCompleted ? "completed" : hasPaused ? "paused" : hasRunning ? "running" : session.status;

  await writeState(state);
  return session;
}

export async function getCurrentExecutionTarget(sessionId: string) {
  const state = await readState();
  const session = state.executionSessions.find((item) => item.id === sessionId);
  if (!session) return undefined;

  const nextJob = session.jobs.find((job) => job.status === "queued" || job.status === "running");
  if (!nextJob) return undefined;

  const targetJob = state.jobs.find((job) => job.id === nextJob.jobId);
  if (!targetJob) return undefined;

  const draft = generateDraft(targetJob, state.profile);

  return {
    sessionId: session.id,
    job: targetJob,
    profile: state.profile,
    draft,
  };
}
