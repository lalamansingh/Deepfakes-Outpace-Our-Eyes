"""Scan Commons categories into a JSONL candidate pool, with small thumbs for contact sheets.
Usage: python3 -I scan.py OUT.jsonl LIMIT "Category:A" "Category:B" ...
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import commons

out, limit, cats = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
seen = set()
if os.path.exists(out):
    for l in open(out):
        seen.add(json.loads(l)["title"])
with open(out, "a") as fh:
    for cat in cats:
        n = 0; cont = {}
        while n < limit:
            d = commons.api({"action": "query", "generator": "categorymembers", "gcmtitle": cat, "gcmtype": "file",
                             "gcmlimit": "50", "prop": "imageinfo", "iiprop": commons.IIPROP, "iiurlwidth": "240", **cont})
            for p in d.get("query", {}).get("pages", []):
                s = commons.summarize(p)
                if s["mime"] not in ("image/jpeg", "image/png", "image/webp"): continue
                if s["title"] in seen: continue
                seen.add(s["title"]); s["srccat"] = cat
                fh.write(json.dumps(s, ensure_ascii=False) + "\n"); n += 1
            if "continue" not in d: break
            cont = d["continue"]
        print(cat, n, file=sys.stderr)
