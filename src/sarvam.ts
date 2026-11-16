const SARVAM_API = "https://api.sarvam.ai";
const STT_MODEL = "saaras:v4";
const TTS_MODEL = "bulbul:v3";

function getApiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    const error = new Error("Sarvam voice is not configured. Add SARVAM_API_KEY to .env.");
    Object.assign(error, { status: 503 });
    throw error;
  }
  return key;
}

async function responseError(response: Response) {
  const detail = (await response.text()).slice(0, 400);
  const error = new Error(`Sarvam request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  Object.assign(error, { status: 502 });
  return error;
}

export async function transcribeAudio(
  audio: Express.Multer.File,
  languageCode: string
): Promise<{ transcript: string; language_code?: string }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio.buffer)], { type: audio.mimetype }), audio.originalname);
  form.append("model", STT_MODEL);
  form.append("language_code", languageCode || "unknown");
  form.append("with_timestamps", "false");

  const response = await fetch(`${SARVAM_API}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": getApiKey() },
    body: form
  });
  if (!response.ok) throw await responseError(response);

  const result = (await response.json()) as { transcript?: unknown; language_code?: unknown };
  if (typeof result.transcript !== "string") {
    throw new Error("Sarvam returned a response without a transcript.");
  }
  return {
    transcript: result.transcript,
    language_code: typeof result.language_code === "string" ? result.language_code : undefined
  };
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<{ audio: string; mimeType: string }> {
  const response = await fetch(`${SARVAM_API}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": getApiKey(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      text,
      target_language_code: languageCode,
      speaker: "shubh",
      model: TTS_MODEL,
      speech_sample_rate: 24000,
      enable_preprocessing: true
    })
  });
  if (!response.ok) throw await responseError(response);

  const result = (await response.json()) as { audios?: unknown };
  const audio = Array.isArray(result.audios) ? result.audios[0] : undefined;
  if (typeof audio !== "string" || !audio) {
    throw new Error("Sarvam returned a response without audio.");
  }
  return { audio, mimeType: "audio/wav" };
}
