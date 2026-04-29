export type AtsType = "greenhouse" | "lever" | "workday" | "unsupported";

export type JobStatus = "draft" | "ready" | "needs_review" | "unsupported" | "manual_only";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "file";

export type CanonicalFieldKey =
  | "fullName"
  | "firstName"
  | "lastName"
  | "preferredName"
  | "email"
  | "phone"
  | "location"
  | "linkedinUrl"
  | "portfolioUrl"
  | "githubUrl"
  | "resume"
  | "coverLetter"
  | "summary"
  | "eligibleToWork"
  | "requiresVisaSponsorship"
  | "willingToRelocate"
  | "currentCompany"
  | "currentTitle"
  | "education"
  | "unknown";

export interface ExperienceItem {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface EducationItem {
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
}

export interface CandidateProfile {
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  summary: string;
  workAuthorization: {
    country: string;
    authorized: boolean;
    requiresSponsorship: boolean;
  };
  documents: {
    resumeFileName: string;
    coverLetterFileName: string;
  };
  screeningAnswers: Record<string, string>;
  experiences: ExperienceItem[];
  education: EducationItem[];
}

export interface JobTarget {
  id: string;
  url: string;
  company: string;
  role: string;
  location: string;
  atsType: AtsType;
  status: JobStatus;
  lastAnalyzedAt?: string;
}

export interface FieldDescriptor {
  id: string;
  key: CanonicalFieldKey;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  source: "template" | "dom";
  selector?: string;
  confidence: number;
}

export interface FieldResolution {
  fieldId: string;
  key: CanonicalFieldKey;
  label: string;
  status: "filled" | "missing" | "manual_required";
  value?: string | boolean;
  reason?: string;
  confidence: number;
}

export interface ApplicationDraft {
  jobId: string;
  atsType: AtsType;
  status: JobStatus;
  fields: FieldDescriptor[];
  resolutions: FieldResolution[];
  missingFields: CanonicalFieldKey[];
  confidenceFlags: string[];
  generatedAt: string;
}

export interface ExecutionEvent {
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
}

export interface ExecutionJobState {
  jobId: string;
  url: string;
  atsType: AtsType;
  status: "queued" | "running" | "paused" | "completed" | "failed";
  pauseReason?: string;
  events: ExecutionEvent[];
}

export interface ExecutionSession {
  id: string;
  createdAt: string;
  status: "pending_confirmation" | "running" | "paused" | "completed";
  jobIds: string[];
  jobs: ExecutionJobState[];
}

export interface FillResult {
  fieldId: string;
  status: "filled" | "skipped" | "manual_required" | "error";
  reason?: string;
}

export interface AtsAdapter {
  type: AtsType;
  detect(url: string): boolean;
  getStandardFields(): FieldDescriptor[];
}

export interface PersistedState {
  profile: CandidateProfile;
  jobs: JobTarget[];
  executionSessions: ExecutionSession[];
}
