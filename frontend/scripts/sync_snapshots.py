"""api/snapshot_*.json -> frontend/public/snapshots/ 복사 + snapshot_index.json 생성.

빌드 전 실행: python scripts/sync_snapshots.py
"""
from pathlib import Path
import shutil
import json
import re
from datetime import datetime

SCRIPT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = SCRIPT_DIR.parent
API_DIR = FRONTEND_DIR.parent / "api"
DEST_DIR = FRONTEND_DIR / "public" / "snapshots"

PATTERN = re.compile(r"^snapshot_(\d{8})\.json$")

def main():
    if not API_DIR.exists():
        print(f"[!] api 디렉토리 없음: {API_DIR}")
        return 1

    DEST_DIR.mkdir(parents=True, exist_ok=True)

    sources = sorted([p for p in API_DIR.glob("snapshot_*.json") if PATTERN.match(p.name)])
    if not sources:
        print(f"[!] api/snapshot_*.json 파일 없음. build_full_snapshot.py 또는 build_snapshots_by_date.py 실행")
        return 1

    # 기존 public/snapshots/ 정리 (snapshot_*.json + index 만)
    for old in DEST_DIR.glob("snapshot_*.json"):
        old.unlink()
    idx = DEST_DIR / "snapshot_index.json"
    if idx.exists():
        idx.unlink()

    dates = []
    for src in sources:
        shutil.copy2(src, DEST_DIR / src.name)
        d = PATTERN.match(src.name).group(1)
        dates.append({"as_of": d, "label": f"{d[:4]}-{d[4:6]}-{d[6:]}"})
        print(f"  ✓ {src.name} ({src.stat().st_size // 1024} KB)")

    index = {
        "generated_at": datetime.now().isoformat(),
        "dates": dates,
        "default": dates[-1]["as_of"] if dates else None,
    }
    with open(idx, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"  ✓ snapshot_index.json ({len(dates)} 날짜, default={index['default']})")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
