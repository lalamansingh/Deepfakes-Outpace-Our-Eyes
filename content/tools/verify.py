"""Print wikitext (trimmed) + categories for each title in a file. Usage: python3 -I verify.py titles.txt"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import commons
for t in [l.strip() for l in open(sys.argv[1]) if l.strip()]:
    try:
        wt = commons.wikitext(t)
    except Exception as e:
        print("=====", t, "ERROR", e); continue
    cats = re.findall(r"\[\[Category:([^\]|]+)", wt)
    body = re.sub(r"\[\[Category:[^\]]+\]\]", "", wt)
    body = re.sub(r"\n+", " ", body)
    print("=====", t); print(body[:900]); print("CATS:", cats); print()
