"""Scan categories for REAL candidates: upload before 2021-01-01 AND camera Make/Model in metadata.
Usage: python3 -I scan_real.py OUT.jsonl PER_CAT_LIMIT MAX_PAGES "Category:A" ...
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import commons
out, limit, maxpages, cats = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
seen = set()
if os.path.exists(out):
    seen = {json.loads(l)["title"] for l in open(out)}
with open(out, "a") as fh:
    for cat in cats:
        n = pages = 0; cont = {}
        while n < limit and pages < maxpages:
            d = commons.api({"action": "query", "generator": "categorymembers", "gcmtitle": cat, "gcmtype": "file",
                             "gcmlimit": "50", "gcmsort": "timestamp", "gcmdir": "ascending",
                             "prop": "imageinfo", "iiprop": commons.IIPROP, "iiurlwidth": "240", **cont})
            pages += 1
            for p in d.get("query", {}).get("pages", []):
                s = commons.summarize(p)
                if s["mime"] != "image/jpeg" or s["title"] in seen: continue
                if not s["ts"] or s["ts"] >= "2021-01-01": continue
                if not (s["make"] and s["model"]): continue
                if (s["w"] or 0) < 1200: continue
                seen.add(s["title"]); s["srccat"] = cat
                fh.write(json.dumps(s, ensure_ascii=False) + "\n"); n += 1
                if n >= limit: break
            if "continue" not in d: break
            cont = d["continue"]
        print(cat, n, file=sys.stderr)
