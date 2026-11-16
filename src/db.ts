import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const databasePath = path.resolve(process.env.SQLITE_PATH ?? "./data/kaam-saathi.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    employer_name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    pay_min INTEGER NOT NULL,
    pay_max INTEGER NOT NULL,
    pay_period TEXT NOT NULL,
    work_type TEXT NOT NULL,
    description TEXT NOT NULL,
    required_skills TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'closed')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS worker_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '',
    work_preference TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    worker_id TEXT NOT NULL REFERENCES worker_profiles(id),
    status TEXT NOT NULL CHECK (status IN ('submitted', 'reviewing', 'contacted', 'hired', 'not_selected')),
    consent_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (job_id, worker_id)
  );
`);

const demoJobs = [
  {
    id: "demo-field-assistant",
    title: "Field assistant",
    employer_name: "Sample local farm",
    category: "Agriculture",
    location: "Nashik, Maharashtra",
    pay_min: 500,
    pay_max: 700,
    pay_period: "day",
    work_type: "Seasonal",
    description: "Help with sorting and packing produce during the harvest period.",
    required_skills: "Sorting, packing",
    status: "approved"
  },
  {
    id: "demo-service-helper",
    title: "Two-wheeler service helper",
    employer_name: "Sample repair workshop",
    category: "Repair",
    location: "Pune, Maharashtra",
    pay_min: 12000,
    pay_max: 16000,
    pay_period: "month",
    work_type: "Full-time",
    description: "Assist a mechanic with basic servicing, tools, and keeping the work area organized.",
    required_skills: "Basic tools, willingness to learn",
    status: "approved"
  },
  {
    id: "demo-store-assistant",
    title: "Store assistant",
    employer_name: "Sample neighbourhood shop",
    category: "Retail",
    location: "Satara, Maharashtra",
    pay_min: 9000,
    pay_max: 12000,
    pay_period: "month",
    work_type: "Full-time",
    description: "Help customers, arrange stock, and support daily shop tasks.",
    required_skills: "Customer service, basic numeracy",
    status: "approved"
  }
];

const insertDemoJob = db.prepare(`
  INSERT OR IGNORE INTO jobs (
    id, title, employer_name, category, location, pay_min, pay_max,
    pay_period, work_type, description, required_skills, status, is_demo
  ) VALUES (
    @id, @title, @employer_name, @category, @location, @pay_min, @pay_max,
    @pay_period, @work_type, @description, @required_skills, @status, 1
  )
`);

const seedDemoJobs = db.transaction(() => {
  for (const job of demoJobs) insertDemoJob.run(job);
});

seedDemoJobs();
