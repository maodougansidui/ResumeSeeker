# ResumeSeeker

ResumeSeeker is an MVP for an AI-assisted job application copilot:

- a Next.js web app for profile capture, job queueing, application review, and execution telemetry
- a shared TypeScript domain package for ATS detection, field mapping, and fill planning
- a Manifest V3 browser extension that detects supported ATS pages, extracts fields, fills forms, and reports progress

## Workspace

- `apps/web`: Next.js dashboard and API routes
- `apps/extension`: Chrome-compatible MV3 extension
- `packages/shared`: shared domain models and ATS logic
- `data`: local JSON-backed demo persistence

## Getting started

1. `npm install`
2. `npm run dev:web`
3. Open `http://localhost:3000`
4. Build the extension with `npm run build --workspace @resumeseeker/extension`
5. Load `apps/extension` as an unpacked extension in Chrome

## MVP flow

1. Complete the candidate profile in the web app.
2. Add overseas job URLs from Greenhouse, Lever, or Workday.
3. Review generated application drafts and missing fields.
4. Start an execution batch.
5. Use the extension popup on supported application pages to autofill and report status back.
