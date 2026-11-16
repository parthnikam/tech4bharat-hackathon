export type Job = {
  id: string;
  title: string;
  employer_name: string;
  category: string;
  location: string;
  pay_min: number;
  pay_max: number;
  pay_period: "day" | "month";
  work_type: string;
  description: string;
  required_skills: string;
  status: "pending" | "approved" | "closed";
  is_demo: number;
  created_at: string;
};

export type Profile = {
  id: string;
  name: string;
  phone: string;
  location: string;
  skills: string;
  work_preference: string;
  updated_at: string;
};

export type Application = {
  id: string;
  job_id: string;
  worker_id: string;
  status: "submitted" | "reviewing" | "contacted" | "hired" | "not_selected";
  consent_at: string;
  created_at: string;
  job_title: string;
  location: string;
  is_demo: number;
  worker_name?: string;
  worker_phone?: string;
  worker_skills?: string;
};

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { "content-type": "application/json" } : {}),
      ...options?.headers
    }
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The request failed. Please try again.");
  return payload;
}

export function getWorkerId() {
  const current = localStorage.getItem("kaam-saathi-worker-id");
  if (current) return current;
  const id = crypto.randomUUID();
  localStorage.setItem("kaam-saathi-worker-id", id);
  return id;
}
