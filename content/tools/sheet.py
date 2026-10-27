"""Build numbered contact sheets from a JSONL pool. Usage: python3 -I sheet.py POOL.jsonl OUTPREFIX [start] [count]"""
import json, sys, io, urllib.request, time
from PIL import Image, ImageDraw
UA = "RealOrRenderedEducationalGame/0.1 (student project; educational content curation)"
pool = [json.loads(l) for l in open(sys.argv[1])]
start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
count = int(sys.argv[4]) if len(sys.argv) > 4 else len(pool)
items = list(enumerate(pool))[start:start+count]
T, COLS = 240, 6
for s in range(0, len(items), 30):
    chunk = items[s:s+30]
    rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS*T, rows*(T+16)), "white")
    dr = ImageDraw.Draw(sheet)
    for k, (i, it) in enumerate(chunk):
        try:
            req = urllib.request.Request(it["thumb"], headers={"User-Agent": UA})
            im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert("RGB")
            im.thumbnail((T, T)); time.sleep(0.2)
        except Exception as e:
            im = Image.new("RGB", (T, T), "grey")
        x, y = (k % COLS)*T, (k // COLS)*(T+16)
        sheet.paste(im, (x, y+16)); dr.text((x+3, y+2), str(i), fill="red")
    p = f"{sys.argv[2]}_{start+s}.jpg"; sheet.save(p, quality=80); print(p)
