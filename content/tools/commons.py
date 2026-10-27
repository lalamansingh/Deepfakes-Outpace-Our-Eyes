"""Small Wikimedia Commons API helper for curating Real or Rendered content.
Usage:
  python3 -I commons.py subcats "Category:Foo"
  python3 -I commons.py files "Category:Foo" [limit]   -> JSON lines summary
  python3 -I commons.py info "File:Foo.jpg" ...        -> full JSON detail
"""
import json, sys, time, urllib.parse, urllib.request, re, html

API = "https://commons.wikimedia.org/w/api.php"
UA = "RealOrRenderedEducationalGame/0.1 (student project; educational content curation)"

def api(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            time.sleep(1.2)
            return data
        except Exception as e:
            time.sleep(10 * (attempt + 1))
            err = e
    raise err

def strip(s):
    if s is None: return None
    s = re.sub(r"<[^>]+>", "", str(s))
    return html.unescape(s).strip()

def subcats(cat):
    out, cont = [], {}
    while True:
        d = api({"action": "query", "list": "categorymembers", "cmtitle": cat, "cmtype": "subcat", "cmlimit": "500", **cont})
        out += [m["title"] for m in d["query"]["categorymembers"]]
        if "continue" not in d: break
        cont = d["continue"]
    return out

def summarize(p):
    ii = (p.get("imageinfo") or [{}])[0]
    em = ii.get("extmetadata", {})
    md = {m["name"]: m["value"] for m in (ii.get("metadata") or []) if isinstance(m, dict) and "name" in m}
    g = lambda k: strip(em.get(k, {}).get("value"))
    return {
        "title": p["title"], "ts": ii.get("timestamp"), "user": ii.get("user"),
        "w": ii.get("width"), "h": ii.get("height"), "thumb": ii.get("thumburl"),
        "thumbw": ii.get("thumbwidth"), "thumbh": ii.get("thumbheight"),
        "page": ii.get("descriptionurl"), "mime": ii.get("mime"),
        "license": g("LicenseShortName"), "licenseUrl": g("LicenseUrl"),
        "artist": g("Artist"), "credit": g("Credit"), "desc": (g("ImageDescription") or "")[:600],
        "categories": g("Categories"), "make": md.get("Make"), "model": md.get("Model"),
        "dto": md.get("DateTimeOriginal"), "software": md.get("Software"),
    }

IIPROP = "url|size|extmetadata|metadata|timestamp|user|mime"

def files(cat, limit=50):
    out, cont = [], {}
    while len(out) < limit:
        d = api({"action": "query", "generator": "categorymembers", "gcmtitle": cat, "gcmtype": "file",
                 "gcmlimit": str(min(50, limit)), "prop": "imageinfo", "iiprop": IIPROP, "iiurlwidth": "1024", **cont})
        out += [summarize(p) for p in d.get("query", {}).get("pages", [])]
        if "continue" not in d: break
        cont = d["continue"]
    return out[:limit]

def info(titles):
    d = api({"action": "query", "titles": "|".join(titles), "prop": "imageinfo|categories", "cllimit": "500",
             "iiprop": IIPROP, "iiurlwidth": "1024"})
    res = []
    for p in d["query"]["pages"]:
        s = summarize(p)
        s["allcats"] = [c["title"] for c in p.get("categories", [])]
        res.append(s)
    return res

def wikitext(title):
    d = api({"action": "query", "titles": title, "prop": "revisions", "rvprop": "content", "rvslots": "main"})
    return d["query"]["pages"][0]["revisions"][0]["slots"]["main"]["content"]

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "subcats":
        print("\n".join(subcats(sys.argv[2])))
    elif cmd == "files":
        for f in files(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 50):
            print(json.dumps(f, ensure_ascii=False))
    elif cmd == "info":
        print(json.dumps(info(sys.argv[2:]), ensure_ascii=False, indent=1))
    elif cmd == "wikitext":
        print(wikitext(sys.argv[2]))
