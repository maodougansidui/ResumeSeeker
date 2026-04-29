"use client";

import { useMemo, useState } from "react";

import type { ApplicationDraft, CandidateProfile, ExecutionSession, JobTarget } from "@resumeseeker/shared";

type DashboardData = {
  profile: CandidateProfile;
  jobs: JobTarget[];
  drafts: ApplicationDraft[];
  executionSessions: ExecutionSession[];
};

const profileFields: Array<{ key: keyof CandidateProfile; label: string; multiline?: boolean }> = [
  { key: "fullName", label: "Full name" },
  { key: "preferredName", label: "Preferred name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "portfolioUrl", label: "Portfolio URL" },
  { key: "githubUrl", label: "GitHub URL" },
  { key: "summary", label: "Professional summary", multiline: true },
];

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [profile, setProfile] = useState(initialData.profile);
  const [urls, setUrls] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(
    initialData.jobs.filter((job) => job.status !== "unsupported").map((job) => job.id),
  );
  const [activeSessionId, setActiveSessionId] = useState(initialData.executionSessions[0]?.id ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const selectedDrafts = useMemo(
    () => data.drafts.filter((draft) => selectedJobIds.includes(draft.jobId)),
    [data.drafts, selectedJobIds],
  );

  async function refreshDashboard() {
    const response = await fetch("/api/debug/export", { cache: "no-store" });
    const nextData = (await response.json()) as DashboardData;
    setData(nextData);
    if (!activeSessionId && nextData.executionSessions[0]) {
      setActiveSessionId(nextData.executionSessions[0].id);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    await refreshDashboard();
    setSavingProfile(false);
  }

  async function handleAnalyzeJobs() {
    setAnalyzing(true);
    const response = await fetch("/api/jobs/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: urls
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });

    const nextData = (await response.json()) as DashboardData;
    setData(nextData);
    setSelectedJobIds(nextData.jobs.filter((job) => job.status !== "unsupported").map((job) => job.id));
    setUrls("");
    setAnalyzing(false);
  }

  async function handleStartSession() {
    setStartingSession(true);
    const response = await fetch("/api/execution/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobIds: selectedJobIds }),
    });
    const session = (await response.json()) as ExecutionSession;
    setActiveSessionId(session.id);
    await refreshDashboard();
    setStartingSession(false);
  }

  function toggleJob(jobId: string) {
    setSelectedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId],
    );
  }

  const currentSession = data.executionSessions.find((session) => session.id === activeSessionId) ?? data.executionSessions[0];

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">ResumeSeeker MVP</p>
          <h1>Ship targeted multi-company applications without retyping the same story.</h1>
          <p className="hero-copy">
            Capture profile data once, analyze overseas ATS links, review missing fields, and hand the final browser work to
            the extension when you are ready.
          </p>
        </div>
        <div className="hero-stats">
          <Stat label="Tracked jobs" value={String(data.jobs.length)} />
          <Stat label="Ready drafts" value={String(data.drafts.filter((draft) => draft.status === "ready").length)} />
          <Stat label="Active sessions" value={String(data.executionSessions.length)} />
        </div>
      </section>

      <section className="band grid-two">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Candidate profile</h2>
              <p>One structured profile feeds both draft generation and extension autofill.</p>
            </div>
            <button className="primary-button" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </div>

          <div className="form-grid">
            {profileFields.map((field) => (
              <label key={field.key} className={field.multiline ? "span-2" : ""}>
                <span>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    value={String(profile[field.key] ?? "")}
                    onChange={(event) => setProfile({ ...profile, [field.key]: event.target.value })}
                    rows={4}
                  />
                ) : (
                  <input
                    value={String(profile[field.key] ?? "")}
                    onChange={(event) => setProfile({ ...profile, [field.key]: event.target.value })}
                  />
                )}
              </label>
            ))}

            <label>
              <span>Authorized to work</span>
              <select
                value={profile.screeningAnswers.eligibleToWork ?? "Yes"}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    screeningAnswers: { ...profile.screeningAnswers, eligibleToWork: event.target.value },
                  })
                }
              >
                <option>Yes</option>
                <option>No</option>
              </select>
            </label>

            <label>
              <span>Requires sponsorship</span>
              <select
                value={profile.screeningAnswers.requiresVisaSponsorship ?? "No"}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    screeningAnswers: { ...profile.screeningAnswers, requiresVisaSponsorship: event.target.value },
                  })
                }
              >
                <option>No</option>
                <option>Yes</option>
              </select>
            </label>

            <label>
              <span>Resume filename</span>
              <input
                value={profile.documents.resumeFileName}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    documents: { ...profile.documents, resumeFileName: event.target.value },
                  })
                }
              />
            </label>

            <label>
              <span>Cover letter filename</span>
              <input
                value={profile.documents.coverLetterFileName}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    documents: { ...profile.documents, coverLetterFileName: event.target.value },
                  })
                }
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Job intake</h2>
              <p>Paste one ATS URL per line. ResumeSeeker classifies the provider and builds a draft instantly.</p>
            </div>
            <button className="primary-button" onClick={handleAnalyzeJobs} disabled={analyzing}>
              {analyzing ? "Analyzing..." : "Analyze jobs"}
            </button>
          </div>
          <textarea
            className="intake"
            placeholder={"https://boards.greenhouse.io/example/jobs/123\nhttps://jobs.lever.co/example/abc"}
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            rows={10}
          />
          <div className="helper-list">
            <span>Supported now: Greenhouse</span>
            <span>Lever</span>
            <span>Workday</span>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Batch review</h2>
              <p>Select target jobs, inspect field confidence, and only then start the execution session.</p>
            </div>
            <button className="primary-button" onClick={handleStartSession} disabled={startingSession || selectedJobIds.length === 0}>
              {startingSession ? "Starting..." : "Start execution batch"}
            </button>
          </div>

          <div className="job-table">
            {data.jobs.map((job) => {
              const draft = data.drafts.find((item) => item.jobId === job.id);
              return (
                <label key={job.id} className="job-row">
                  <input
                    type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={() => toggleJob(job.id)}
                    disabled={job.status === "unsupported"}
                  />
                  <div>
                    <strong>{job.role}</strong>
                    <div className="muted">
                      {job.company} • {job.atsType} • {job.location}
                    </div>
                  </div>
                  <span className={`status-chip status-${draft?.status ?? job.status}`}>{draft?.status ?? job.status}</span>
                </label>
              );
            })}
          </div>

          <div className="draft-grid">
            {selectedDrafts.map((draft) => (
              <article key={draft.jobId} className="draft-card">
                <div className="draft-header">
                  <div>
                    <h3>{data.jobs.find((job) => job.id === draft.jobId)?.role}</h3>
                    <p>{data.jobs.find((job) => job.id === draft.jobId)?.company}</p>
                  </div>
                  <span className={`status-chip status-${draft.status}`}>{draft.status}</span>
                </div>
                <div className="draft-body">
                  <div>
                    <h4>Mapped fields</h4>
                    <ul>
                      {draft.resolutions.slice(0, 6).map((resolution) => (
                        <li key={resolution.fieldId}>
                          <span>{resolution.label}</span>
                          <strong>{resolution.status}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Needs review</h4>
                    {draft.confidenceFlags.length > 0 ? (
                      <ul>
                        {draft.confidenceFlags.slice(0, 4).map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No open review flags.</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band grid-two">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Execution telemetry</h2>
              <p>Sessions stay pending until the extension confirms a browser-side execution on a supported page.</p>
            </div>
            <button className="secondary-button" onClick={refreshDashboard}>
              Refresh
            </button>
          </div>
          {currentSession ? (
            <div className="session-stack">
              <div className="session-summary">
                <span className={`status-chip status-${currentSession.status}`}>{currentSession.status}</span>
                <span>{currentSession.id}</span>
              </div>
              {currentSession.jobs.map((job) => (
                <div key={job.jobId} className="session-job">
                  <div className="session-job-header">
                    <strong>{data.jobs.find((item) => item.id === job.jobId)?.role ?? job.jobId}</strong>
                    <span className={`status-chip status-${job.status}`}>{job.status}</span>
                  </div>
                  <ul className="event-list">
                    {job.events.slice(0, 4).map((event, index) => (
                      <li key={`${event.timestamp}-${index}`}>
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                        <p>{event.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No execution session yet. Start a batch after reviewing your target jobs.</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Extension handoff</h2>
              <p>Open a queued ATS job in the browser, then use the popup to fetch the current target and autofill the page.</p>
            </div>
          </div>
          <ol className="steps-list">
            <li>Run the web app locally and keep this dashboard open.</li>
            <li>Build and load the extension from `apps/extension`.</li>
            <li>Set the API base URL in the popup to your local web app.</li>
            <li>Paste the active session ID shown here into the popup.</li>
            <li>Visit a Greenhouse, Lever, or Workday application page and click autofill.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
