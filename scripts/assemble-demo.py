"""Assemble actual browser frame captures with English captions; no synthesized UI.

Usage: python3 scripts/assemble-demo.py /absolute/capture-directory
Each scene directory contains frames.json: [{"file":"000001.jpg","ms":0}, ...].
Preserves real frame intervals. Outputs are exclusive: existing renders are never overwritten.
"""
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1]).resolve(strict=True)
repo = Path(__file__).resolve().parents[1]
scenes = json.loads((repo / "docs/demo-scenes.json").read_text())
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 32)
parts = []
total = 0
for scene in scenes:
    folder = root / scene["id"]
    frames = json.loads((folder / "frames.json").read_text())
    if len(frames) < 2:
        raise ValueError(f"Missing actual motion capture: {folder}")
    end = frames[-1]["ms"] / 1000
    total += end
    if end <= 0:
        raise ValueError("Invalid frame times")
    listing = folder / "frames.ffconcat"
    with listing.open("x") as out:
        out.write("ffconcat version 1.0\n")
        for index, frame in enumerate(frames):
            path = (folder / frame["file"]).resolve(strict=True)
            if path.parent != folder or "'" in str(path):
                raise ValueError("Unexpected frame path")
            out.write(f"file '{path}'\n")
            if index + 1 < len(frames):
                delta = (frames[index + 1]["ms"] - frame["ms"]) / 1000
                if delta <= 0:
                    raise ValueError("Frame times must increase")
                out.write(f"duration {delta:.6f}\n")
    caption = folder / "caption.png"
    canvas = Image.new("RGB", (1920, 112), "#f4f0e5")
    draw = ImageDraw.Draw(canvas)
    for line_no, line in enumerate(scene["caption"].splitlines()):
        width = draw.textlength(line, font=font)
        if width > 1800:
            raise ValueError("Caption overflows")
        draw.text(((1920-width)/2, 8+line_no*40), line, font=font, fill="#19362c")
    with caption.open("xb") as handle:
        canvas.save(handle, format="PNG")
    output = folder / "captioned.mp4"
    subprocess.run([
        "ffmpeg", "-nostdin", "-n", "-hide_banner", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(listing), "-i", str(caption),
        "-filter_complex",
        "[0:v]scale=1728:936,pad=1920:1080:96:24:color=0xf4f0e5[screen];"
        "[screen][1:v]overlay=0:968,setsar=1,fps=30[v]",
        "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "fast",
        "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output)
    ], check=True)
    parts.append(output)
if total >= 178:
    raise ValueError(f"Demo is too long: {total:.1f}s")
playlist = root / "parts.ffconcat"
with playlist.open("x") as out:
    for path in parts:
        out.write(f"file '{path}'\n")
final = root / "SpikeSlot-demo-English.mp4"
subprocess.run([
    "ffmpeg", "-nostdin", "-n", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", str(playlist), "-c", "copy",
    "-movflags", "+faststart", str(final)
], check=True)
print(json.dumps({"video": str(final), "captured_seconds": total, "audio": "none; English captions"}))
