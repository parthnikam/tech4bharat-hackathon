import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileCheck2,
  Filter,
  Handshake,
  MapPin,
  Menu,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Volume2,
  X
} from "lucide-react";
import { api, getWorkerId, type Application, type Job, type Profile } from "./api.ts";
import { parseJobVoice, type JobVoiceValues } from "./job-voice.ts";

type Role = "worker" | "recruiter";
type Language = "en-IN" | "hi-IN" | "mr-IN" | "ta-IN" | "bn-IN" | "kn-IN" | "te-IN";
type Page = "explore" | "applications" | "profile" | "overview" | "jobs";

const languages: { code: Language; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "mr-IN", label: "मराठी" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "te-IN", label: "తెలుగు" }
];

const languageNames: Record<Language, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "mr-IN": "Marathi",
  "ta-IN": "Tamil",
  "bn-IN": "Bengali",
  "kn-IN": "Kannada",
  "te-IN": "Telugu"
};

const workerNav: { id: Page; label: string; icon: typeof BriefcaseBusiness }[] = [
  { id: "explore", label: "Find work", icon: Search },
  { id: "applications", label: "My applications", icon: ClipboardList },
  { id: "profile", label: "My profile", icon: UserRound }
];

const recruiterNav: { id: Page; label: string; icon: typeof BriefcaseBusiness }[] = [
  { id: "overview", label: "Overview", icon: BriefcaseBusiness },
  { id: "jobs", label: "Jobs & candidates", icon: UsersRound }
];

const initialProfile = {
  name: "",
  phone: "",
  location: "",
  skills: "",
  workPreference: ""
};

function rupees(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function payLabel(job: Job) {
  return `₹${rupees(job.pay_min)}–${rupees(job.pay_max)} / ${job.pay_period}`;
}

function statusLabel(status: Application["status"]) {
  return {
    submitted: "Sent",
    reviewing: "Being reviewed",
    contacted: "Employer contacted you",
    hired: "Hired",
    not_selected: "Not selected"
  }[status];
}

function App() {
  const [role, setRole] = useState<Role>("worker");
  const [page, setPage] = useState<Page>("explore");
  const [language, setLanguage] = useState<Language>("en-IN");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workerId] = useState(getWorkerId);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showJobForm, setShowJobForm] = useState(false);
  const [applyingTo, setApplyingTo] = useState<Job | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshJobs = useCallback(async () => {
    const path = role === "recruiter" ? "/api/jobs?view=recruiter" : "/api/jobs";
    const result = await api<Job[]>(path);
    setJobs(result);
  }, [role]);

  const refreshApplications = useCallback(async () => {
    const path = role === "worker"
      ? `/api/applications?workerId=${encodeURIComponent(workerId)}`
      : "/api/applications";
    setApplications(await api<Application[]>(path));
  }, [role, workerId]);

  const refreshProfile = useCallback(async () => {
    setProfile(await api<Profile | null>(`/api/profile/${workerId}`));
  }, [workerId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([refreshJobs(), refreshApplications(), refreshProfile()])
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "We could not load your workspace.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshJobs, refreshApplications, refreshProfile]);

  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) =>
      [job.title, job.category, job.location, job.required_skills, job.work_type].some((value) =>
        value.toLocaleLowerCase().includes(needle)
      )
    );
  }, [jobs, query]);

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setPage(nextRole === "worker" ? "explore" : "overview");
    setMenuOpen(false);
    setError("");
  }

  function showPage(nextPage: Page) {
    setPage(nextPage);
    setMenuOpen(false);
    setError("");
  }

  async function saveProfile(values: typeof initialProfile) {
    setError("");
    setNotice("");
    try {
      await api<Profile>(`/api/profile/${workerId}`, {
        method: "PUT",
        body: JSON.stringify(values)
      });
      await refreshProfile();
      setNotice("Your profile is saved on this device.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your profile.");
    }
  }

  async function applyToJob(job: Job, consent: boolean) {
    setError("");
    setNotice("");
    try {
      await api<Application>(`/api/jobs/${job.id}/applications`, {
        method: "POST",
        body: JSON.stringify({ workerId, consent })
      });
      setApplyingTo(null);
      await refreshApplications();
      setNotice("Application saved on this device. This demo does not contact an employer.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not submit your application.");
    }
  }

  async function submitJob(values: Record<string, string>) {
    setError("");
    setNotice("");
    try {
      await api<Job>("/api/jobs", { method: "POST", body: JSON.stringify(values) });
      setShowJobForm(false);
      await refreshJobs();
      setNotice("Job submitted. It stays hidden from workers until it is reviewed.");
      setPage("jobs");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not submit this job.");
    }
  }

  async function updateApplication(applicationId: string, status: Application["status"]) {
    setError("");
    try {
      await api<Application>(`/api/applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await refreshApplications();
      setNotice("Candidate status updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not update this application.");
    }
  }

  const nav = role === "worker" ? workerNav : recruiterNav;
  const pendingCount = jobs.filter((job) => job.status === "pending").length;
  const listedCount = jobs.filter((job) => job.status === "approved").length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => showPage(role === "worker" ? "explore" : "overview")} aria-label="Kaam Saathi home">
          <span className="brand-mark"><Handshake size={20} strokeWidth={2.2} /></span>
          <span className="brand-copy">
            <strong>kaam saathi</strong>
            <small>work, closer to home</small>
          </span>
        </button>

        <div className="topbar-actions">
          <label className="language-control">
            <span className="sr-only">Choose language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <button className="help-button" onClick={() => setNotice("Need help? Ask a trusted local partner to use this app with you.")}>
            <CircleHelp size={17} />
            <span>Help</span>
          </button>
          <button className="avatar" onClick={() => showPage(role === "worker" ? "profile" : "overview")} aria-label="Open account">
            {role === "worker" ? <UserRound size={17} /> : <BriefcaseBusiness size={17} />}
          </button>
        </div>
      </header>

      <div className="role-switch" role="tablist" aria-label="Choose your workspace">
        <button className={role === "worker" ? "selected" : ""} onClick={() => switchRole("worker")} role="tab" aria-selected={role === "worker"}>
          <UserRound size={16} /> I’m looking for work
        </button>
        <button className={role === "recruiter" ? "selected" : ""} onClick={() => switchRole("recruiter")} role="tab" aria-selected={role === "recruiter"}>
          <BriefcaseBusiness size={16} /> I’m hiring
        </button>
      </div>

      <div className="workspace">
        <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-heading">{role === "worker" ? "YOUR WORKSPACE" : "EMPLOYER SPACE"}</div>
          <nav aria-label="Main navigation">
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => showPage(id)}>
                <Icon size={18} />
                <span>{label}</span>
                {id === "applications" && applications.length > 0 && role === "worker" &&
                  <span className="nav-count">{applications.length}</span>}
                {id === "jobs" && pendingCount > 0 && role === "recruiter" &&
                  <span className="nav-count">{pendingCount}</span>}
              </button>
            ))}
          </nav>
          {role === "worker" ? (
            <div className="trust-note">
              <span className="trust-icon"><ShieldCheck size={18} /></span>
              <div><strong>Your details stay yours</strong><p>We ask before sharing your contact details with an employer.</p></div>
            </div>
          ) : (
            <div className="trust-note">
              <span className="trust-icon"><FileCheck2 size={18} /></span>
              <div><strong>Checked before listing</strong><p>New jobs stay private until required details are reviewed.</p></div>
            </div>
          )}
          <div className="sidebar-bottom">
            <div className="offline-indicator"><span /> Saved on this device</div>
            <span className="prototype-label">LOCAL PROTOTYPE</span>
          </div>
        </aside>

        <main className="main-content">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
            <span>{menuOpen ? "Close menu" : "Menu"}</span>
          </button>
          {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}
          {loading ? <LoadingState /> : (
            <>
              {role === "worker" && page === "explore" && (
                <WorkerExplore
                  jobs={visibleJobs}
                  query={query}
                  setQuery={setQuery}
                  profile={profile}
                  language={language}
                  onApply={setApplyingTo}
                />
              )}
              {role === "worker" && page === "applications" && (
                <WorkerApplications applications={applications} onExplore={() => showPage("explore")} />
              )}
              {role === "worker" && page === "profile" && (
                <ProfilePage profile={profile} onSave={saveProfile} />
              )}
              {role === "recruiter" && page === "overview" && (
                <RecruiterOverview
                  jobs={jobs}
                  applications={applications}
                  listedCount={listedCount}
                  pendingCount={pendingCount}
                  onPost={() => setShowJobForm(true)}
                  onOpenJobs={() => showPage("jobs")}
                />
              )}
              {role === "recruiter" && page === "jobs" && (
                <RecruiterJobs
                  jobs={jobs}
                  applications={applications}
                  onPost={() => setShowJobForm(true)}
                  onUpdate={updateApplication}
                />
              )}
            </>
          )}
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? "active" : ""} onClick={() => showPage(id)}>
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
        {role === "recruiter" && (
          <button onClick={() => setShowJobForm(true)}><Plus size={19} /><span>Post job</span></button>
        )}
      </nav>

      {showJobForm && <JobForm language={language} onClose={() => setShowJobForm(false)} onSubmit={submitJob} />}
      {applyingTo && (
        <ApplyDialog
          job={applyingTo}
          profile={profile}
          onClose={() => setApplyingTo(null)}
          onProfile={() => { setApplyingTo(null); showPage("profile"); }}
          onApply={(consent) => applyToJob(applyingTo, consent)}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return <div className="loading-state"><span className="loader" /> Loading your workspace…</div>;
}

function PageIntro({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="intro-action">{action}</div>}
    </div>
  );
}

function WorkerExplore({ jobs, query, setQuery, profile, language, onApply }: {
  jobs: Job[];
  query: string;
  setQuery: (value: string) => void;
  profile: Profile | null;
  language: Language;
  onApply: (job: Job) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const recordingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    setVoiceError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice recording is not available in this browser. You can search by typing instead.");
      return;
    }
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = currentStream;
      const instance = new MediaRecorder(currentStream);
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      instance.onstop = async () => {
        currentStream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const audio = new Blob(chunks.current, { type: instance.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", audio, "voice-note.webm");
        form.append("languageCode", language);
        setVoiceBusy(true);
        try {
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const result = await response.json() as { transcript?: string; error?: string };
          if (!response.ok) throw new Error(result.error ?? "We could not understand that recording.");
          const transcript = result.transcript?.trim() ?? "";
          if (!transcript) throw new Error("We did not hear any words. Try a short recording or type your search.");
          setVoiceText(transcript);
          setQuery(transcript);
        } catch (cause) {
          setVoiceError(cause instanceof Error ? cause.message : "We could not process that recording.");
        } finally {
          setVoiceBusy(false);
        }
      };
      recorder.current = instance;
      instance.start();
      recordingTimeout.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 15000);
      setRecording(true);
    } catch {
      setVoiceError("Microphone access was not allowed. You can search by typing instead.");
    }
  }

  function stopRecording() {
    if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function hearPrompt() {
    setVoiceError("");
    setSpeaking(true);
    try {
      const result = await api<{ audio: string; mimeType: string }>("/api/voice/speak", {
        method: "POST",
        body: JSON.stringify({
          text: "Tell us what kind of work you are looking for.",
          languageCode: language
        })
      });
      const player = new Audio(`data:${result.mimeType};base64,${result.audio}`);
      await player.play();
    } catch (cause) {
      setVoiceError(cause instanceof Error ? cause.message : "We could not play the voice prompt.");
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="A better way to find local work"
        title={profile?.name ? `Namaste, ${profile.name.split(" ")[0]}` : "Work that fits your life"}
        description="Find clear, nearby opportunities. Take your time—your details are shared only with your permission."
      />
      <section className="voice-panel" aria-label="Voice job search">
        <div className="voice-copy">
          <span className="voice-kicker"><Sparkles size={14} /> START WITH YOUR VOICE</span>
          <h2>Tell us what kind of work you’re looking for.</h2>
          <p>Speak naturally in {languageNames[language]}. We’ll show the words so you can check them.</p>
          <div className="voice-actions">
            <button className="button button-outline voice-listen" onClick={hearPrompt} disabled={speaking}>
              <Volume2 size={16} /> {speaking ? "Preparing voice…" : "Hear the prompt"}
            </button>
            {!recording ? (
              <button className="button button-dark" onClick={startRecording} disabled={voiceBusy}>
                {voiceBusy ? <span className="mini-loader" /> : <Mic size={17} />}
                {voiceBusy ? "Listening to your note…" : "Speak to search"}
              </button>
            ) : (
              <button className="button button-recording" onClick={stopRecording}>
                <span className="record-dot" /> Stop recording
              </button>
            )}
            <span className="voice-privacy"><ShieldCheck size={14} /> Recording sent for transcription only</span>
          </div>
        </div>
        <div className="voice-illustration" aria-hidden="true">
          <div className="voice-sun" />
          <div className="voice-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <span className="voice-language">नमस्ते</span>
          <span className="voice-language-secondary">வணக்கம்</span>
        </div>
        {(voiceError || voiceText) && (
          <div className={`transcript-note ${voiceError ? "has-error" : ""}`}>
            {voiceError || <>We heard: <strong>“{voiceText}”</strong> <span>Change the search if it isn’t right.</span></>}
          </div>
        )}
      </section>

      <div className="section-heading jobs-heading">
        <div>
          <div className="eyebrow">YOUR NEXT STEP</div>
          <h2>Work near you</h2>
          <p>Pay and location are shown upfront. Sample listings are clearly marked.</p>
        </div>
        <span className="result-count">{jobs.length} {jobs.length === 1 ? "opportunity" : "opportunities"}</span>
      </div>

      <div className="search-row">
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “farm work” or a town name" aria-label="Search jobs" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={16} /></button>}
        </label>
        <button className="filter-button" onClick={() => setQuery(query ? "" : "Seasonal")} aria-label="Toggle seasonal filter"><Filter size={17} /><span>Seasonal</span></button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No jobs match that search yet" body="Try a different job type or location. New checked listings will show here." />
      ) : (
        <div className="job-list">
          {jobs.map((job) => <WorkerJobCard key={job.id} job={job} onApply={() => onApply(job)} />)}
        </div>
      )}

      <div className="safety-strip">
        <ShieldCheck size={19} />
      <p><strong>A quick safety reminder</strong> — Never pay a fee to apply for a job. <span>If a listing asks for money, stop and tell a trusted local partner.</span></p>
      </div>
    </>
  );
}

function WorkerJobCard({ job, onApply }: { job: Job; onApply: () => void }) {
  return (
    <article className="job-card worker-job-card">
      <div className="job-card-main">
        <div className="job-card-topline">
          <span className="category-tag">{job.category}</span>
          <span className={job.is_demo ? "demo-tag" : "verified-tag"}>
            {job.is_demo ? "SAMPLE · NOT A REAL OPENING" : <><ShieldCheck size={13} /> LISTING REVIEWED</>}
          </span>
        </div>
        <h3>{job.title}</h3>
        <p className="employer-name">{job.employer_name}</p>
        <div className="job-facts">
          <span><MapPin size={15} />{job.location}</span>
          <span><Clock3 size={15} />{job.work_type}</span>
          <span className="pay-fact">{payLabel(job)}</span>
        </div>
        <p className="job-description">{job.description}</p>
        <div className="skill-tags">{job.required_skills.split(",").map((skill) => <span key={skill}>{skill.trim()}</span>)}</div>
      </div>
      <div className="job-card-action">
        <button className="button button-primary" onClick={onApply}>{job.is_demo ? "Try sample apply" : "Apply for this job"} <ArrowUpRight size={15} /></button>
        {job.is_demo ? <small>Saved locally for the demo only</small> : <small>Your contact is shared only after consent</small>}
      </div>
    </article>
  );
}

function WorkerApplications({ applications, onExplore }: {
  applications: Application[];
  onExplore: () => void;
}) {
  return (
    <>
      <PageIntro eyebrow="YOUR JOB JOURNEY" title="My applications" description="Keep track of every job you’ve applied for and what happens next." />
      {applications.length === 0 ? (
        <EmptyState title="Your applications will appear here" body="When you apply for a job, you can follow its progress from this page." action={<button className="button button-primary" onClick={onExplore}>Explore jobs <ArrowUpRight size={15} /></button>} />
      ) : (
        <div className="application-list">
          {applications.map((application) => (
            <article className="application-card" key={application.id}>
              <div className="application-icon"><BriefcaseBusiness size={18} /></div>
              <div className="application-detail">
                <div className="application-title-line"><h3>{application.job_title}</h3>{application.is_demo ? <span className="demo-tag">DEMO</span> : null}</div>
                <p><MapPin size={14} />{application.location}</p>
                <span className="application-date">Applied {new Date(application.created_at + "Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
              <span className={`application-status status-${application.status}`}>{statusLabel(application.status)}</span>
            </article>
          ))}
        </div>
      )}
      <div className="note-panel"><ShieldCheck size={18} /><p>Your contact details are visible only for applications where you chose to share them.</p></div>
    </>
  );
}

function ProfilePage({ profile, onSave }: {
  profile: Profile | null;
  onSave: (values: typeof initialProfile) => void;
}) {
  const [values, setValues] = useState(initialProfile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setValues({
        name: profile.name,
        phone: profile.phone,
        location: profile.location,
        skills: profile.skills,
        workPreference: profile.work_preference
      });
    }
  }, [profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onSave(values);
    setSaving(false);
  }

  return (
    <>
      <PageIntro eyebrow="YOUR DETAILS" title="Your work profile" description="A few details help us find work that fits. You decide when your contact details are shared." />
      <form className="profile-form" onSubmit={submit}>
        <div className="form-section-title"><span>01</span><div><h2>About you</h2><p>Only add details you’re comfortable sharing.</p></div></div>
        <div className="form-grid">
          <label className="field"><span>Your name</span><input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Name you use at work" required maxLength={100} /></label>
          <label className="field"><span>Phone number</span><input value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} placeholder="Number an employer can reach you on" type="tel" required maxLength={20} /></label>
          <label className="field"><span>Village or town</span><input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} placeholder="Where are you based?" required maxLength={120} /></label>
          <label className="field"><span>Work you prefer</span><input value={values.workPreference} onChange={(event) => setValues({ ...values, workPreference: event.target.value })} placeholder="For example, farm or repair work" maxLength={100} /></label>
          <label className="field field-wide"><span>Skills or experience</span><textarea value={values.skills} onChange={(event) => setValues({ ...values, skills: event.target.value })} placeholder="Tell us what you know how to do" rows={3} maxLength={300} /></label>
        </div>
        <div className="profile-privacy"><ShieldCheck size={17} /><p>Your profile is stored in this app’s local database. We ask before sharing your contact details with an employer.</p></div>
        <div className="form-footer"><span>Fields marked for applying: name, phone, and location.</span><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save my profile"} <Check size={16} /></button></div>
      </form>
    </>
  );
}

function RecruiterOverview({ jobs, applications, listedCount, pendingCount, onPost, onOpenJobs }: {
  jobs: Job[];
  applications: Application[];
  listedCount: number;
  pendingCount: number;
  onPost: () => void;
  onOpenJobs: () => void;
}) {
  const recentJobs = jobs.slice(0, 3);
  return (
    <>
      <PageIntro
        eyebrow="EMPLOYER WORKSPACE"
        title="Find the right person, sooner."
        description="Share a clear job, review interested candidates, and keep the hiring process moving."
        action={<button className="button button-primary" onClick={onPost}><Plus size={17} /> Post a job</button>}
      />
      <div className="recruiter-welcome">
        <div><span className="welcome-eyebrow">GOOD WORK STARTS WITH CLARITY</span><h2>Make the role easy to understand.</h2><p>Clear pay, hours, and location help people decide whether a job fits them.</p><button className="text-button" onClick={onPost}>Create a job listing <ArrowUpRight size={15} /></button></div>
        <div className="welcome-art" aria-hidden="true"><div className="welcome-art-card"><BriefcaseBusiness size={27} /><span className="art-line wide" /><span className="art-line" /><span className="art-check"><Check size={14} /></span></div><div className="welcome-art-sun" /></div>
      </div>

      <div className="metrics-row">
        <Metric icon={<BriefcaseBusiness size={17} />} label="Jobs listed" value={listedCount} sub="Visible to workers" />
        <Metric icon={<Clock3 size={17} />} label="Awaiting review" value={pendingCount} sub="Hidden until checked" />
        <Metric icon={<UsersRound size={17} />} label="Applications" value={applications.length} sub="With contact consent" />
      </div>

      <section className="recruiter-section">
        <div className="section-heading compact">
          <div><div className="eyebrow">YOUR OPENINGS</div><h2>Recent jobs</h2></div>
          <button className="link-button" onClick={onOpenJobs}>View all <ArrowUpRight size={14} /></button>
        </div>
        {recentJobs.length === 0 ? <EmptyState title="No jobs posted yet" body="Create your first listing to start hearing from workers." action={<button className="button button-primary" onClick={onPost}>Post a job <Plus size={15} /></button>} /> : (
          <div className="recruiter-job-list">
            {recentJobs.map((job) => <RecruiterJobRow key={job.id} job={job} />)}
          </div>
        )}
      </section>

      <div className="recruiter-guidance">
        <div className="guidance-icon"><FileCheck2 size={19} /></div>
        <div><strong>Trust starts with a checked listing</strong><p>New jobs stay hidden while the listing details are reviewed. Never ask a worker to pay to apply.</p></div>
        <ArrowDownRight className="guidance-arrow" size={18} />
      </div>
    </>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="metric-card">
      <div className="metric-top">{icon}<span>{label}</span></div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function RecruiterJobs({ jobs, applications, onPost, onUpdate }: {
  jobs: Job[];
  applications: Application[];
  onPost: () => void;
  onUpdate: (id: string, status: Application["status"]) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const filtered = jobs.filter((job) => filter === "all" || job.status === filter);
  return (
    <>
      <PageIntro
        eyebrow="HIRING OVERVIEW"
        title="Jobs & candidates"
        description="Track listing reviews and speak with people who have chosen to apply."
        action={<button className="button button-primary" onClick={onPost}><Plus size={17} /> Post a job</button>}
      />
      <div className="jobs-filter-row" role="tablist" aria-label="Filter jobs">
        {(["all", "pending", "approved"] as const).map((value) => (
          <button key={value} className={filter === value ? "filter-active" : ""} onClick={() => setFilter(value)} role="tab" aria-selected={filter === value}>
            {value === "all" ? "All jobs" : value === "pending" ? "Needs review" : "Listed"}
            <span>{value === "all" ? jobs.length : jobs.filter((job) => job.status === value).length}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <EmptyState title={filter === "pending" ? "Nothing waiting for review" : "No jobs in this list"} body="When you submit a job, its status will be shown here." /> : (
        <div className="recruiter-job-list full-list">
          {filtered.map((job) => <RecruiterJobRow key={job.id} job={job} />)}
        </div>
      )}
      <section className="candidates-section">
        <div className="section-heading compact"><div><div className="eyebrow">CONSENT-BASED CANDIDATES</div><h2>Applications received</h2></div><span className="candidate-count">{applications.length} total</span></div>
        {applications.length === 0 ? (
          <EmptyState title="Candidates will appear here" body="Only workers who choose to apply and share their contact details will be shown." />
        ) : (
          <div className="candidate-list">
            {applications.map((application) => (
              <article className="candidate-card" key={application.id}>
                <div className="candidate-avatar">{application.worker_name?.slice(0, 1).toLocaleUpperCase() ?? <UserRound size={18} />}</div>
                <div className="candidate-info">
                  <div className="candidate-name-row"><h3>{application.worker_name}</h3>{application.is_demo ? <span className="demo-tag">DEMO</span> : null}</div>
                  <p>{application.job_title} · {application.location}</p>
                  <span className="candidate-phone">{application.worker_phone}</span>
                  {application.worker_skills && <span className="candidate-skills">{application.worker_skills}</span>}
                  <small>Shared when this worker chose to apply</small>
                </div>
                <div className="candidate-actions">
                  <span className={`application-status status-${application.status}`}>{statusLabel(application.status)}</span>
                  {application.status === "submitted" && <button onClick={() => onUpdate(application.id, "reviewing")}>Mark reviewing</button>}
                  {application.status === "reviewing" && <button onClick={() => onUpdate(application.id, "contacted")}>Mark contacted</button>}
                  {application.status === "contacted" && <button onClick={() => onUpdate(application.id, "hired")}>Mark hired</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function RecruiterJobRow({ job }: { job: Job }) {
  const label = job.status === "pending" ? "Awaiting review" : job.status === "approved" ? "Listed" : "Closed";
  return (
    <article className="recruiter-job-row">
      <div className="recruiter-job-icon"><BriefcaseBusiness size={17} /></div>
      <div className="recruiter-job-detail">
        <div className="recruiter-job-title"><h3>{job.title}</h3>{job.is_demo ? <span className="demo-tag">SAMPLE</span> : null}</div>
        <p><MapPin size={14} />{job.location}<span className="row-divider">·</span>{payLabel(job)}</p>
      </div>
      <div className="recruiter-job-meta"><span className={`listing-status status-${job.status}`}>{label}</span></div>
    </article>
  );
}

function JobForm({ language, onClose, onSubmit }: {
  language: Language;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<JobVoiceValues>({
    employerName: "",
    title: "",
    category: "",
    location: "",
    payMin: "",
    payMax: "",
    payPeriod: "month",
    workType: "Full-time",
    description: "",
    requiredSkills: ""
  });
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const recordingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onSubmit(values);
    setSaving(false);
  }

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function startRecording() {
    setVoiceError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice recording is not available in this browser. You can fill in the form instead.");
      return;
    }
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = currentStream;
      const instance = new MediaRecorder(currentStream);
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      instance.onstop = async () => {
        currentStream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const audio = new Blob(chunks.current, { type: instance.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", audio, "job-details.webm");
        form.append("languageCode", language);
        setVoiceBusy(true);
        try {
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const result = await response.json() as { transcript?: string; error?: string };
          if (!response.ok) throw new Error(result.error ?? "We could not understand that recording.");
          const transcript = result.transcript?.trim() ?? "";
          if (!transcript) throw new Error("We did not hear any words. Try again or fill in the form.");
          setVoiceText(transcript);
          setValues((current) => parseJobVoice(transcript, current));
        } catch (cause) {
          setVoiceError(cause instanceof Error ? cause.message : "We could not process that recording.");
        } finally {
          setVoiceBusy(false);
        }
      };
      recorder.current = instance;
      instance.start();
      recordingTimeout.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 30000);
      setRecording(true);
    } catch {
      setVoiceError("Microphone access was not allowed. You can fill in the form instead.");
    }
  }

  function stopRecording() {
    if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal job-modal" role="dialog" aria-modal="true" aria-labelledby="job-form-title">
        <header className="modal-header"><div><div className="eyebrow">NEW OPPORTUNITY</div><h2 id="job-form-title">Post a job</h2></div><button className="icon-button" onClick={onClose} aria-label="Close form"><X size={19} /></button></header>
        <p className="modal-intro">Clear details help workers decide if a job is right for them. Your listing stays hidden until reviewed.</p>
        <section className="job-voice-entry" aria-label="Describe the job by voice">
          <div className="job-voice-copy">
            <strong><Mic size={16} /> Describe the job in your language</strong>
            <p>Say the business name, work, location, pay, schedule, and skills. We’ll fill what we can; check every detail before submitting.</p>
          </div>
          {!recording ? (
            <button type="button" className="button button-dark" onClick={startRecording} disabled={voiceBusy || saving}>
              {voiceBusy ? <span className="mini-loader" /> : <Mic size={16} />}
              {voiceBusy ? "Transcribing…" : voiceText ? "Record again" : "Speak job details"}
            </button>
          ) : (
            <button type="button" className="button button-recording" onClick={stopRecording}>
              <span className="record-dot" /> Stop recording
            </button>
          )}
          {voiceError && <p className="job-voice-feedback has-error" role="alert">{voiceError}</p>}
          {voiceText && <p className="job-voice-feedback" role="status">Heard: “{voiceText}”</p>}
          <small className="job-voice-privacy"><ShieldCheck size={13} /> Audio is sent to Sarvam for transcription. Review the filled form before submitting.</small>
        </section>
        <form onSubmit={submit}>
          <div className="form-grid modal-grid">
            <label className="field"><span>Business or employer name</span><input value={values.employerName} onChange={(event) => update("employerName", event.target.value)} placeholder="Name of your business" required maxLength={100} /></label>
            <label className="field"><span>Job title</span><input value={values.title} onChange={(event) => update("title", event.target.value)} placeholder="What work needs doing?" required maxLength={100} /></label>
            <label className="field"><span>Type of work</span><input value={values.category} onChange={(event) => update("category", event.target.value)} placeholder="For example, farming" required maxLength={60} /></label>
            <label className="field"><span>Work location</span><input value={values.location} onChange={(event) => update("location", event.target.value)} placeholder="Village, town, and district" required maxLength={120} /></label>
            <div className="field field-wide"><span>Pay range</span><div className="pay-input-row"><input type="number" min="1" value={values.payMin} onChange={(event) => update("payMin", event.target.value)} placeholder="From ₹" required /><span>to</span><input type="number" min="1" value={values.payMax} onChange={(event) => update("payMax", event.target.value)} placeholder="To ₹" required /><select value={values.payPeriod} onChange={(event) => update("payPeriod", event.target.value)}><option value="month">per month</option><option value="day">per day</option></select></div></div>
            <label className="field"><span>Work schedule</span><select value={values.workType} onChange={(event) => update("workType", event.target.value)}><option>Full-time</option><option>Part-time</option><option>Seasonal</option></select></label>
            <label className="field"><span>Skills needed</span><input value={values.requiredSkills} onChange={(event) => update("requiredSkills", event.target.value)} placeholder="Separate skills with commas" required maxLength={300} /></label>
            <label className="field field-wide"><span>What will the worker do?</span><textarea value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the day-to-day work and any important conditions." rows={3} required maxLength={1200} /></label>
          </div>
          <div className="listing-review-note"><ShieldCheck size={17} /><p><strong>Before it goes live:</strong> we’ll check the pay, location, and job details. No fees can be charged to workers to apply.</p></div>
          <footer className="modal-footer"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Sending…" : "Submit for review"} <ArrowUpRight size={15} /></button></footer>
        </form>
      </section>
    </div>
  );
}

function ApplyDialog({ job, profile, onClose, onProfile, onApply }: {
  job: Job;
  profile: Profile | null;
  onClose: () => void;
  onProfile: () => void;
  onApply: (consent: boolean) => void;
}) {
  const [consent, setConsent] = useState(false);
  const complete = Boolean(profile?.name && profile.phone && profile.location);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal apply-modal" role="dialog" aria-modal="true" aria-labelledby="apply-title">
        <header className="modal-header"><div><div className="eyebrow">YOUR NEXT STEP</div><h2 id="apply-title">Apply for {job.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close application"><X size={19} /></button></header>
        <div className="apply-job-summary"><strong>{job.employer_name}</strong><span><MapPin size={14} />{job.location}</span><span className="pay-fact">{payLabel(job)}</span></div>
        {job.is_demo && <div className="demo-notice">This is a sample listing. Your application stays on this device and will not reach an employer.</div>}
        {!profile || !complete ? (
          <div className="profile-needed"><UserRound size={21} /><div><strong>Complete your profile first</strong><p>Add your name, phone number, and location to apply.</p></div><button className="button button-outline" onClick={onProfile}>Open profile</button></div>
        ) : (
          <>
            <div className="sharing-preview"><span>DETAILS THAT MAY BE SHARED</span><strong>{profile.name}</strong><small>{profile.phone} · {profile.location}</small></div>
            <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to share my name and phone number with this employer for this application.</span></label>
            <p className="consent-note">You can choose separately for every job. Your full profile is not shared.</p>
            <footer className="modal-footer"><button className="button button-outline" onClick={onClose}>Not now</button><button className="button button-primary" disabled={!consent} onClick={() => onApply(consent)}>Confirm application <ArrowUpRight size={15} /></button></footer>
          </>
        )}
      </section>
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><BriefcaseBusiness size={19} /></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export default App;
