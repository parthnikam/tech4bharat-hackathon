import "dotenv/config";
import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.ts";
import { synthesizeSpeech, transcribeAudio } from "./sarvam.ts";

const app = express();
const port = Number(process.env.PORT ?? 3100);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientBuild = path.join(projectRoot, "dist", "client");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("audio/")) {
      const error = new Error("Please upload an audio recording.");
      Object.assign(error, { status: 400 });
      callback(error);
      return;
    }
    callback(null, true);
  }
});

app.use(express.json({ limit: "100kb" }));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(body: Record<string, unknown>, key: string, maxLength: number) {
  const value = body[key];
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(value);
}

function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", storage: "sqlite" });
});

app.get("/api/jobs", (request, response) => {
  const view = request.query.view === "recruiter";
  const query = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 80) : "";
  const jobs = view
    ? db.prepare(`
        SELECT * FROM jobs
        WHERE (@query = '' OR title LIKE @pattern OR category LIKE @pattern OR location LIKE @pattern)
        ORDER BY is_demo DESC, created_at DESC
      `).all({ query, pattern: `%${query}%` })
    : db.prepare(`
        SELECT * FROM jobs
        WHERE status = 'approved'
          AND (@query = '' OR title LIKE @pattern OR category LIKE @pattern OR location LIKE @pattern)
        ORDER BY is_demo DESC, created_at DESC
      `).all({ query, pattern: `%${query}%` });
  response.json(jobs);
});

app.post("/api/jobs", (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: "Please enter the job details and try again." });
    return;
  }
  const body = request.body;
  const title = stringField(body, "title", 100);
  const employerName = stringField(body, "employerName", 100);
  const category = stringField(body, "category", 60);
  const location = stringField(body, "location", 120);
  const description = stringField(body, "description", 1200);
  const requiredSkills = stringField(body, "requiredSkills", 300);
  const payMin = Number(body.payMin);
  const payMax = Number(body.payMax);
  const payPeriod = body.payPeriod;
  const workType = stringField(body, "workType", 40);

  if (
    !title || !employerName || !category || !location || !description ||
    !requiredSkills || !Number.isInteger(payMin) || !Number.isInteger(payMax) ||
    payMin < 1 || payMax < payMin ||
    (payPeriod !== "day" && payPeriod !== "month") ||
    !["Full-time", "Part-time", "Seasonal"].includes(workType)
  ) {
    response.status(400).json({ error: "Check each required field. The pay range must be valid." });
    return;
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO jobs (
      id, title, employer_name, category, location, pay_min, pay_max,
      pay_period, work_type, description, required_skills, status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
  `).run(
    id, title, employerName, category, location, payMin, payMax,
    payPeriod, workType, description, requiredSkills
  );
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  response.status(201).json(job);
});

app.get("/api/profile/:workerId", (request, response) => {
  if (!validId(request.params.workerId)) {
    response.status(400).json({ error: "This profile ID is invalid. Refresh and try again." });
    return;
  }
  const profile = db.prepare("SELECT * FROM worker_profiles WHERE id = ?").get(request.params.workerId);
  response.json(profile ?? null);
});

app.put("/api/profile/:workerId", (request, response) => {
  if (!validId(request.params.workerId) || !isRecord(request.body)) {
    response.status(400).json({ error: "This profile could not be saved. Check the details and try again." });
    return;
  }
  const body = request.body;
  const name = stringField(body, "name", 100);
  const phone = stringField(body, "phone", 20);
  const location = stringField(body, "location", 120);
  const skills = stringField(body, "skills", 300);
  const workPreference = stringField(body, "workPreference", 100);
  if (!name || !/^[+\d\s()-]{8,20}$/.test(phone) || !location) {
    response.status(400).json({ error: "Add your name, a valid phone number, and your location." });
    return;
  }

  db.prepare(`
    INSERT INTO worker_profiles (id, name, phone, location, skills, work_preference, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      phone = excluded.phone,
      location = excluded.location,
      skills = excluded.skills,
      work_preference = excluded.work_preference,
      updated_at = CURRENT_TIMESTAMP
  `).run(request.params.workerId, name, phone, location, skills, workPreference);
  response.json(db.prepare("SELECT * FROM worker_profiles WHERE id = ?").get(request.params.workerId));
});

app.get("/api/applications", (request, response) => {
  const workerId = typeof request.query.workerId === "string" ? request.query.workerId : "";
  const applications = workerId
    ? db.prepare(`
        SELECT applications.*, jobs.title AS job_title, jobs.location, jobs.is_demo
        FROM applications
        JOIN jobs ON jobs.id = applications.job_id
        WHERE applications.worker_id = ?
        ORDER BY applications.created_at DESC
      `).all(workerId)
    : db.prepare(`
        SELECT applications.*, jobs.title AS job_title, jobs.location,
          worker_profiles.name AS worker_name, worker_profiles.phone AS worker_phone,
          worker_profiles.skills AS worker_skills, jobs.is_demo
        FROM applications
        JOIN jobs ON jobs.id = applications.job_id
        JOIN worker_profiles ON worker_profiles.id = applications.worker_id
        WHERE applications.consent_at != ''
        ORDER BY applications.created_at DESC
      `).all();
  response.json(applications);
});

app.post("/api/jobs/:jobId/applications", (request, response) => {
  if (!validId(request.params.jobId) || !isRecord(request.body)) {
    response.status(400).json({ error: "This application could not be submitted. Refresh and try again." });
    return;
  }
  const workerId = request.body.workerId;
  if (!validId(workerId) || request.body.consent !== true) {
    response.status(400).json({ error: "Review the contact-sharing choice before applying." });
    return;
  }
  const profile = db.prepare("SELECT name, phone FROM worker_profiles WHERE id = ?").get(workerId) as
    { name: string; phone: string } | undefined;
  if (!profile?.name || !profile.phone) {
    response.status(400).json({ error: "Add your name and phone number in your profile before applying." });
    return;
  }
  const job = db.prepare("SELECT id FROM jobs WHERE id = ? AND status = 'approved'").get(request.params.jobId);
  if (!job) {
    response.status(404).json({ error: "This job is no longer available." });
    return;
  }

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO applications (id, job_id, worker_id, status, consent_at)
      VALUES (?, ?, ?, 'submitted', CURRENT_TIMESTAMP)
    `).run(id, request.params.jobId, workerId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      response.status(409).json({ error: "You have already applied to this job." });
      return;
    }
    throw error;
  }
  response.status(201).json(db.prepare("SELECT * FROM applications WHERE id = ?").get(id));
});

app.patch("/api/applications/:applicationId/status", (request, response) => {
  const status = isRecord(request.body) ? request.body.status : undefined;
  if (!validId(request.params.applicationId) ||
      !["reviewing", "contacted", "hired", "not_selected"].includes(String(status))) {
    response.status(400).json({ error: "Choose a valid application status." });
    return;
  }
  const result = db.prepare("UPDATE applications SET status = ? WHERE id = ?")
    .run(status, request.params.applicationId);
  if (result.changes === 0) {
    response.status(404).json({ error: "This application could not be found." });
    return;
  }
  response.json(db.prepare("SELECT * FROM applications WHERE id = ?").get(request.params.applicationId));
});

app.post("/api/voice/transcribe", upload.single("audio"), asyncRoute(async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "Record a short voice note before continuing." });
    return;
  }
  const languageCode = typeof request.body.languageCode === "string"
    ? request.body.languageCode.slice(0, 12)
    : "unknown";
  response.json(await transcribeAudio(request.file, languageCode));
}));

app.post("/api/voice/speak", asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: "Add text to speak." });
    return;
  }
  const text = stringField(request.body, "text", 500);
  const languageCode = stringField(request.body, "languageCode", 12);
  if (!text || !/^[a-z]{2}-[A-Z]{2}$/.test(languageCode)) {
    response.status(400).json({ error: "Add text and select a supported language." });
    return;
  }
  response.json(await synthesizeSpeech(text, languageCode));
}));

if (existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(clientBuild, "index.html")));
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const status = isRecord(error) && typeof error.status === "number"
    ? error.status
    : isRecord(error) && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  const message = error instanceof Error ? error.message : "The request failed. Please try again.";
  if (status >= 500) console.error(error);
  response.status(status).json({
    error: status === 500 ? "Something went wrong. Please try again." : message
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Kaam Saathi API listening at http://127.0.0.1:${port}`);
});
