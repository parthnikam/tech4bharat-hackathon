# 8.2 Rural youth cannot find work that fits, and small employers cannot find them

`AGENTIC AI`

* The problem. Young rural workers lack a reliable way to find work that matches their skills, location and income needs. Employers take 2–3 months to hire by word of mouth, and 40–50% of hires fail within three months.

* Who lives with this. These are young people with school, ITI or college qualifications looking for local or seasonal
work, and small employers who need hands quickly.

* How it gets handled today. Jobs travel through relatives, WhatsApp forwards and agents, and employers hire
whoever a contact recommends.

* What it costs. Beyond slow hiring and early exits, workers lose money to fake listings and unpaid wages.

* Who else is in the picture.
    1. Small employers
    2. Skilling centres and ITIs
    3. Placement agents
    4. Panchayats and employment schemes

* What makes it hard. Workers need protection from fraudulent listings, bias has to be controlled, and skills have to be verified from video.

* Boundaries. Listings are checked before they reach workers, and a worker's details go to an employer only with consent.

* Questions to take into the field.
    1. How did young people here find their last job?
    2. Why did the last hire leave within three months?
    3. What does an employer check before hiring?
    4. How far will a worker travel, and for what wage?
    5. Has anyone here been cheated by a fake listing?
    6. Which skills do employers say are missing?

**Following the money. Ask an employer what a bad hire costs.**


I’ll ground the plan in the problem statement in the repository, then outline a practical product, architecture, and phased build approach.

Read 
Completed with input: {
  "path": "C:\\Users\\108pa\\Parth\\Projects\\Tech4Bharat_Hackathon_2026\\README.md"
}

Find files matching `**/*`

# Product plan: trusted, voice-first local jobs

## 1. The problem to solve

Rural young people struggle to find legitimate work that fits their skills, location, availability, and income needs. Small employers struggle to find suitable workers quickly, often relying on informal referrals that can lead to slow hiring and poor-fit placements.

The app should make it easy to **find and fill local jobs**, while reducing scams and keeping workers in control of their information.

## 2. Product direction

Build a **mobile-first, voice-friendly job app** for workers and small employers. Workers can speak in their language to create a profile and find relevant jobs. Employers can post a job simply, then review suitable candidates. Listings are checked before workers see them, and a worker’s contact details or profile are shared only after they consent.

Keep the experience focused: **“Tell us what work you’re looking for”** for workers and **“Tell us who you need”** for employers.

## 3. Who will use it

- **Workers:** Young people with school, ITI, or college qualifications looking for local, seasonal, or entry-level work.
- **Small employers:** Businesses, farms, workshops, and other local employers who need workers quickly.
- **Verifiers and partners:** Trusted local organizations, such as ITIs, skilling centres, or designated staff, who can help check listings and verify skills.

Start with workers and employers. Add partner tools only where they help make verification practical.

## 4. Core user experiences

### Worker: find work without filling out a long form

1. Choose a language and start by voice or simple text.
2. Answer a few short questions: location, preferred work, skills, availability, expected pay, and travel range.
3. Review the profile the app created; correct anything that is wrong.
4. See a short list of relevant jobs, with clear pay, location, hours, and employer verification status.
5. Apply with one tap. The app asks before sharing any personal details beyond what the worker has already chosen to disclose.
6. Get status updates and reminders in their chosen language.

**Keep essential details visible:** job type, wages, distance, working hours, duration, and how the employer was checked. Avoid making workers interpret a complex match score.

### Employer: describe a job and find candidates

1. Create an employer account and complete basic checks.
2. Describe the job using a guided form or voice.
3. Confirm pay, location, hours, duration, required skills, and who to contact.
4. Submit it for review; do not show it to workers until it passes the listing checks.
5. Review a small set of relevant candidates and request contact details through the app.
6. Record whether a candidate was contacted, hired, or did not work out.

### Verification and operations

A reviewer can check new listings, flag suspicious ones, and request corrections. Skills can be supported by credentials or short video evidence where useful; reviewers should validate evidence rather than relying on an AI-only decision. Give users a straightforward way to report a fake listing, unsafe conditions, or unpaid wages.

## 5. A simple mobile-first interface

Use a **progressive web app (PWA)** for the first version: it opens in a mobile browser, can be added to the home screen, and avoids the friction of installing a native app during an early pilot.

Keep navigation to a few clear areas:

- **Find work**
- **My profile**
- **Applications**
- **Post a job** (for employers)

Design for low digital confidence and inconsistent connectivity:

- Large buttons, short screens, plain language, and familiar icons with text labels.
- Voice as an option, never the only way to use the app.
- A visible “edit” or “that’s not right” option after voice transcription.
- Save progress and retry when connectivity returns.
- Show a clear loading, saved, or failed state instead of silently dropping a user’s input.
- Support assisted use by a trusted partner without sharing the worker’s account or consent.

## 6. Practical technical architecture

### Frontend

- Mobile-first PWA with a small, fast interface.
- Language selection and text alternatives on every voice-driven step.
- Record only the audio needed for the current interaction; make recording and upload status visible.

### Backend

- **Node.js with TypeScript** for the API and background workers.
- **PostgreSQL** as the source of truth for users, jobs, applications, consent, verification status, and audit history.
- Private object storage for optional audio and skill-evidence files, with short-lived access links and a defined retention policy.
- A job queue for slower tasks such as transcription, translation, listing review, and notifications. For an MVP, keep the queue and deployment simple; add dedicated infrastructure only when actual volume requires it.

### Voice and language support

Use **Sarvam’s voice APIs** for supported Indian-language speech-to-text and text-to-speech. The flow should be:

1. Ask for the minimum information needed in a short prompt.
2. Transcribe the response.
3. Show or read back the interpreted answer.
4. Let the user correct it before saving.
5. Save structured fields to PostgreSQL, not just a transcript.

For languages or conditions where speech recognition performs poorly, offer text input, replay, and a “get help” path. Validate Sarvam’s language coverage and performance with local speakers before choosing the initial pilot languages.

### Matching

Start with explainable rules rather than an AI ranking system. Filter and rank based on:

- Required skills and experience
- Location and travel willingness
- Pay expectations
- Availability and job duration

Show why a job appears—such as “near your village” or “matches your preferred work.” Do not infer sensitive traits or use a match score as a substitute for worker or employer choice.

### SQL and Mem0

Use **PostgreSQL for reliable, auditable application data**. Mem0 can be added for conversational continuity—such as remembering that a worker prefers responses in a certain language or is looking for seasonal work—but it should not be the authority for applications, consent, wages, or verification.

Keep memory optional, let users inspect or delete it, and avoid storing sensitive information unless there is a clear product need and user permission. If Mem0 is not necessary to make the MVP useful, defer it until after testing the core experience.

### Background work

Tasks that can happen after the user submits a request include:

- Transcription and translation
- Listing checks and moderation queues
- Finding new matches
- Notifications and reminders
- Aggregated pilot reporting

Show users when an action is pending and notify them when it completes. Never make a background AI action silently publish a listing, share private information, or make a hiring decision.

## 7. Trust, safety, and privacy

Treat worker protection as a core product feature:

- Verify employer identity and contact information to a level appropriate for the pilot.
- Review listings before publication; flag unrealistic pay, suspicious requests, or requests for upfront fees.
- Clearly label what “verified” means—avoid implying a guarantee of job safety.
- Never charge workers to apply or reveal a job.
- Ask before sharing a worker’s profile or contact details with an employer; record consent and allow it to be withdrawn.
- Collect only information needed to match and support the application.
- Restrict access to recordings and videos; define who can view them and when they are deleted.
- Maintain an audit trail for listing decisions, profile sharing, and user reports.
- Provide accessible reporting and a human escalation route.

## 8. MVP scope

### Include

- Worker and employer onboarding
- Two or three pilot languages selected with local users
- Voice-assisted worker profile creation, with text fallback and correction
- Employer job submission
- Human review and verification status for listings
- Rule-based job matching and one-tap applications
- Consent-based profile sharing
- Basic notifications and application status
- Admin tools for reviewing listings and reports

### Defer

- Fully automated video skill scoring
- AI deciding who should be hired
- Complex recommendation models
- Payments, payroll, or wage guarantees
- Large-scale partner portals
- Broad language coverage before measuring voice accuracy locally

## 9. Delivery roadmap

### Phase 1 — Field discovery and service design

Talk to workers, employers, and local partners using the questions in the README. Pay special attention to how people describe skills, acceptable travel distance, wages, hiring checks, and past scams. Prototype the worker and employer journeys in the actual pilot languages and test them with people who have varied literacy and smartphone experience.

**Deliverable:** validated first-job categories, pilot geography, languages, and a tested low-fidelity flow.

### Phase 2 — Build a usable pilot

Implement the PWA, backend, core database, voice-assisted profile flow, job posting, human listing review, matching, consent, and application updates. Build the reviewer view early because a trusted listing process is necessary for the worker experience to be credible.

**Deliverable:** a complete journey for one worker to discover and apply to one checked job, and one employer to post and review candidates.

### Phase 3 — Run a small, supervised pilot

Launch with a manageable group of employers and workers in one area. Have a human review every listing, observe where users need help, and contact users to verify whether listed jobs and application updates are accurate.

**Deliverable:** evidence about trust, usability, match quality, and whether hiring outcomes improve.

### Phase 4 — Improve before expanding

Fix the biggest issues found in the pilot—especially voice recognition, unclear job details, verification delays, and unsuccessful applications. Expand to additional locations or languages only when local support and listing checks can keep pace.

## 10. What to measure

Track a few outcomes that directly test the problem:

- Percentage of workers who complete a profile, with and without assistance
- Time from opening the app to seeing a relevant job
- Percentage of applications that receive a response
- Time for employers to fill a role
- Percentage of hires still working after 30 and 90 days
- Listing rejection rate and user-reported scam rate
- Voice transcription correction rate by language
- Worker understanding of, and comfort with, profile-sharing consent

Treat these as pilot measures, not claims of success. Establish a baseline with field interviews and the first cohort before setting firm targets.

## 11. Main risks and practical responses

| Risk | Practical response |
|---|---|
| Fake employers or misleading jobs | Review listings before publication; explain verification status; provide fast reporting |
| Voice transcription errors | Read or show the interpreted answer and let the user correct it before saving |
| Workers lack reliable data access | Keep pages lightweight, save progress, and offer text and assisted-use options |
| Bias in matching or skill review | Use job-related, visible criteria; keep human review for evidence; allow corrections and appeals |
| Workers’ details are shared too broadly | Separate profile creation from employer sharing; require explicit, recorded consent |
| Employers do not provide useful job details | Require clear pay, location, hours, and duration before review |
| Too much scope for an early build | Pilot one area and a few job types; add features only when evidence supports them |

## 12. Recommended first decisions

Before implementation, validate three things with the first field cohort:

1. Which job categories and local area should the pilot cover?
2. Which languages should be supported first?
3. Who will review employer listings, and how quickly can they do it?

**Recommended starting point:** a PWA for one pilot area, a small number of local job categories, voice-assisted onboarding with text fallback, rule-based matching, and human-checked listings. Keep SQL as the source of truth; add Mem0 only if testing shows conversational memory meaningfully improves usability.

This plan is now represented by a local working prototype. See the setup notes below.

## 13. Run the local prototype

The prototype uses Node.js 24+, React with Vite, an Express API, and a local SQLite database. It is intentionally bound to `127.0.0.1` and does not include production authentication.

1. Install Node.js 24 or newer and npm.
2. Install dependencies with `npm install`.
3. Keep the existing `.env` file private. If setting up a fresh copy, copy `.env.example` to `.env` and add a Sarvam API key.
4. Start the frontend and API with `npm run dev`.
5. Open the Vite URL printed in the terminal.

`npm run build` checks TypeScript and creates the production frontend. `npm start` serves the built app and API on `http://127.0.0.1:3100`. SQLite data is stored in `data/kaam-saathi.sqlite` by default; change `SQLITE_PATH` in `.env` to use a different local file.

The app has worker and recruiter views, consent-based sample applications, a profile form, job posting with pending review, and Sarvam speech-to-text and text-to-speech routes. Sample listings are explicitly marked and are not real vacancies. New employer posts stay hidden from workers until reviewed. The voice interface uses the chosen language for Sarvam voice requests; the rest of this wireframe is currently in English.

### Sarvam MCP for VS Code

The workspace MCP configuration in `.vscode/mcp.json` starts Sarvam’s official MCP server through `uvx sarvam-mcp`. Install `uv` (Python 3.11+ is required by the server), keep `SARVAM_API_KEY` in the ignored `.env` file, then start the Sarvam server from VS Code’s MCP controls. This exposes Sarvam’s available speech, translation, language, text, and document tools to the coding assistant. The app’s runtime voice requests go through the Node backend and never expose the key to the browser.

SQLite is the current source of truth. Mem0 and authentication are deliberately deferred; do not expose this prototype to real workers or employers until identity, access control, data retention, and a real listing-review process are implemented.