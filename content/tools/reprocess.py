"""Re-create the 1024px-wide, metadata-free JPEGs from previously downloaded originals (no network).
Usage: python3 -I reprocess.py selection_meta.json MEDIA_DIR DOWNLOAD_DIR"""
import sys, os, json
from PIL import Image
meta_path, media, dl = sys.argv[1:4]
meta = json.load(open(meta_path))
for slug, m in meta.items():
    im = Image.open(os.path.join(dl, slug + ".orig")).convert("RGB")
    if im.width > 1024:
        im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
    clean = Image.new("RGB", im.size); clean.paste(im)
    clean.save(os.path.join(media, slug + ".jpg"), "JPEG", quality=85, optimize=True)
    assert (clean.width, clean.height) == (m["width"], m["height"]), slug
print("reprocessed", len(meta))
