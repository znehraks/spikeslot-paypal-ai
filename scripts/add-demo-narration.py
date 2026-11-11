"""Align recorded narration to the existing demo without changing its video.

Usage: python3 scripts/add-demo-narration.py /absolute/source.mp4 /absolute/audio-dir
The audio directory contains one MP3 per docs/demo-narration.json cue.
All outputs are exclusive; source footage and voice recordings are preserved.
"""
import json
import subprocess
import sys
from pathlib import Path


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams",
        "-of", "json", str(path)
    ]))


source = Path(sys.argv[1]).resolve(strict=True)
root = Path(sys.argv[2]).resolve(strict=True)
repo = Path(__file__).resolve().parents[1]
cues = json.loads((repo / "docs/demo-narration.json").read_text())
duration = float(probe(source)["format"]["duration"])
if len(cues) != 12 or abs(cues[-1]["end"] - duration) > 0.05:
    raise ValueError("Narration cues do not match the recorded video")
voiceover = root / "SpikeSlot-narration-English.wav"
final = root / "SpikeSlot-demo-English-narrated.mp4"
report = root / "narration-alignment.json"
if any(p.exists() for p in [voiceover, final, report]):
    raise FileExistsError("Use a new output directory; existing outputs are preserved")

base = ["ffmpeg", "-nostdin", "-n", "-hide_banner", "-loglevel", "error"]
segments = []
alignment = []
previous_end = 0
for cue in cues:
    path = root / (cue["id"] + ".mp3")
    seconds = float(probe(path)["format"]["duration"])
    start = cue["start"] + 0.35
    if cue["start"] < previous_end or seconds <= 0 or start + seconds > cue["end"] - 0.15:
        raise ValueError(f"Narration cannot fit safely in scene: {cue['id']}")
    previous_end = cue["end"]
    segment = root / (cue["id"] + "-aligned.wav")
    segment_duration = cue["end"] - cue["start"]
    samples = round(segment_duration * 48000)
    # Reset filter timestamps and trim by samples so encoder offsets cannot cut speech.
    subprocess.run(base + [
        "-i", str(path), "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,asetpts=N/SR/TB,"
        f"adelay=16800S:all=1,apad=whole_len={samples},atrim=end_sample={samples},"
        "asetpts=N/SR/TB", "-c:a", "pcm_s24le", str(segment)
    ], check=True)
    if abs(float(probe(segment)["format"]["duration"]) - segment_duration) > 0.01:
        raise ValueError(f"Aligned audio duration mismatch: {cue['id']}")
    segments.append(segment)
    alignment.append({"id": cue["id"], "start": start, "end": start + seconds,
                      "scene_end": cue["end"], "source_seconds": seconds,
                      "speed": 1.0})
playlist = root / "narration.ffconcat"
with playlist.open("x") as out:
    for path in segments:
        if "'" in str(path):
            raise ValueError("Unexpected audio path")
        out.write(f"file '{path}'\n")
subprocess.run(base + [
    "-f", "concat", "-safe", "0", "-i", str(playlist), "-c:a", "copy", str(voiceover)
], check=True)
if abs(float(probe(voiceover)["format"]["duration"]) - duration) > 0.05:
    raise ValueError("Combined voiceover duration does not match the video")
subprocess.run(base + [
    "-i", str(source), "-i", str(voiceover), "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-metadata:s:a:0", "language=eng", "-movflags", "+faststart", str(final)
], check=True)
audio = next(s for s in probe(final)["streams"] if s["codec_type"] == "audio")
if abs(float(audio["duration"]) - duration) > 0.05:
    raise ValueError("Muxed audio duration does not match the video")
with report.open("x") as out:
    json.dump({"source": str(source), "video": str(final), "duration": duration,
               "voiceover": str(voiceover), "alignment": alignment}, out, indent=2)
print(json.dumps({"video": str(final), "voiceover": str(voiceover), "seconds": duration}))
