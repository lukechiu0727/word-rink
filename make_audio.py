#!/usr/bin/env python3
"""Generate natural-voice audio clips for Word Rink / Word Pitch.

Usage:
  pip install edge-tts
  python make_audio.py            # run inside the app folder (next to audio-manifest.json)
  python make_audio.py --voice en-US-AvaMultilingualNeural --rate -10%

Creates ./audio/<key>.mp3 for every entry in audio-manifest.json. Skips clips that already
exist, so you can re-run it safely. Optional: if ffmpeg is installed, pass --shrink to re-encode
to 32 kbps mono (roughly halves the size).

Good voices to try (edge-tts --list-voices | grep en-US):
  en-US-AriaNeural (default, warm, clear)   en-US-AvaMultilingualNeural   en-US-JennyNeural
  en-US-AndrewMultilingualNeural (male)     en-US-GuyNeural (male)
"""
import asyncio, json, os, sys, argparse, shutil, subprocess
try:
    import edge_tts
except ImportError:
    sys.exit("Run: pip install edge-tts")

ap = argparse.ArgumentParser()
ap.add_argument("--voice", default="en-US-AriaNeural")
ap.add_argument("--rate", default="-5%", help="speech rate, e.g. -10% for slower")
ap.add_argument("--word-rate", default="-15%", help="rate for single words (slower, clearer)")
ap.add_argument("--manifest", default="audio-manifest.json")
ap.add_argument("--out", default="audio")
ap.add_argument("--jobs", type=int, default=6)
ap.add_argument("--shrink", action="store_true", help="re-encode with ffmpeg to 32 kbps mono")
a = ap.parse_args()

items = json.load(open(a.manifest, encoding="utf-8"))
os.makedirs(a.out, exist_ok=True)
todo = [(k, t) for k, t in items if not os.path.exists(os.path.join(a.out, k + ".mp3"))]
print(f"{len(items)} clips in manifest, {len(todo)} to generate")

sem = asyncio.Semaphore(a.jobs)
done = 0
async def one(key, text):
    global done
    rate = a.word_rate if " " not in text.strip() else a.rate
    path = os.path.join(a.out, key + ".mp3")
    for attempt in range(3):
        try:
            async with sem:
                await edge_tts.Communicate(text, a.voice, rate=rate).save(path)
            break
        except Exception as e:
            if attempt == 2:
                print("FAILED", key, e)
                return
            await asyncio.sleep(2)
    done += 1
    if done % 50 == 0:
        print(f"  {done}/{len(todo)}")

async def main():
    await asyncio.gather(*(one(k, t) for k, t in todo))
asyncio.run(main())

if a.shrink:
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found; skipping --shrink")
    for k, _ in items:
        p = os.path.join(a.out, k + ".mp3"); tmp = p + ".tmp.mp3"
        if os.path.exists(p):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", p, "-ac", "1", "-b:a", "32k", tmp])
            os.replace(tmp, p)
    print("re-encoded")
total = sum(os.path.getsize(os.path.join(a.out, k + ".mp3")) for k, _ in items if os.path.exists(os.path.join(a.out, k + ".mp3")))
print(f"done. audio folder ≈ {total/1e6:.1f} MB")
