export async function stopAfterSpeech(
  stream: MediaStream,
  onSpeechEnd: () => void,
  silenceDuration = 1200
): Promise<() => void> {
  const context = new AudioContext();
  let source: MediaStreamAudioSourceNode | null = null;
  let interval: number | null = null;
  let active = true;
  try {
    source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    await context.resume();

    const samples = new Uint8Array(analyser.fftSize);
    let heardSpeech = false;
    let quietSince: number | null = null;
    interval = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      const energy = samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length;
      const isSpeech = Math.sqrt(energy) / 128 >= 0.035;

      if (isSpeech) {
        heardSpeech = true;
        quietSince = null;
      } else if (heardSpeech) {
        quietSince ??= Date.now();
        if (Date.now() - quietSince >= silenceDuration) {
          cleanup();
          onSpeechEnd();
        }
      }
    }, 100);

    function cleanup() {
      if (!active) return;
      active = false;
      if (interval !== null) window.clearInterval(interval);
      source?.disconnect();
      source = null;
      void context.close();
    }

    return cleanup;
  } catch (cause) {
    active = false;
    if (interval !== null) window.clearInterval(interval);
    source?.disconnect();
    if (context.state !== "closed") await context.close();
    throw cause;
  }
}
