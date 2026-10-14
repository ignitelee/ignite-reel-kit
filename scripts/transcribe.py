"""Free local transcription with word timings (faster-whisper, CPU, int8). Mac + Windows.

Run through uv so nothing has to be installed by hand:
  node scripts/transcribe.mjs video-projects/<reel>/assets/raw.mp4
Writes <input>.json next to the input in the kit's word format:
  {"text", "audio_duration_secs", "words": [{"text", "start", "end"}]}
Env: WHISPER_MODEL (default large-v3-turbo), WHISPER_LANGUAGE (default: auto-detect).
"""
import json, os, subprocess, sys, time

src = os.path.abspath(sys.argv[1])
out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".json"
model_name = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
language = os.environ.get("WHISPER_LANGUAGE") or None

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
    capture_output=True, text=True, check=True).stdout.strip())

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import numpy as np
from faster_whisper import WhisperModel  # after the ffprobe check, so a bad path fails fast

t = time.time()
# decode with ffmpeg (already required) instead of PyAV: 16 kHz mono float32, what Whisper expects
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
print(f"loading {model_name} (first run downloads it once, ~1.6 GB)...", flush=True)
model = WhisperModel(model_name, device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language=language, word_timestamps=True, vad_filter=False, beam_size=5)
words = []
for seg in segments:
    for w in seg.words or []:
        text = w.word.strip()
        if text:
            words.append({"text": text, "start": round(w.start, 3), "end": round(max(w.end, w.start), 3)})
    print(f"  {seg.end:6.1f}s / {dur:.1f}s", flush=True)

with open(out, "w", encoding="utf-8", newline="\n") as f:
    json.dump({"text": " ".join(w["text"] for w in words), "audio_duration_secs": round(dur, 3), "words": words,
               "language": info.language, "provider": f"faster-whisper {model_name} (local)"}, f, ensure_ascii=False, indent=1)

# A repeated take can be merged into one stretched word: flag them so they get checked.
long = [w for w in words if w["end"] - w["start"] > 0.75]
print(f"ok {time.time()-t:.0f}s | {len(words)} words | {dur:.1f}s audio | language {info.language} | {out}")
if long:
    print(f"CHECK {len(long)} words longer than 0.75 s (possible hidden retake): "
          + ", ".join(f"{w['text']}@{w['start']:.2f}" for w in long[:12]))
