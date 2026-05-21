"""모든 sector 에서 한투 펀드가 상위권에 노출되는 셋팅 탐색.

평가 지표:
  - 각 sector 안의 한투 top 5 진입 수
  - 한투 펀드가 통과한 sector 수 (한투 통과)
  - sector 평균 한투 ranking percentile (낮을수록 우수)
"""
import json
from collections import defaultdict
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
with open(API_DIR / "snapshot.json", encoding="utf-8") as f:
    SNAPSHOT = json.load(f)
HANTO = "한국투자신탁운용"
SECTORS = ["국내주식", "국내채권", "해외주식", "해외채권", "혼합형", "기타"]


def get_sharp(f, p): return f.get(f"sharp_{p.lower()}")
def get_yield(f, p): return f.get(f"yield_{p.lower()}")


def is_scorable(f, period):
    sh = get_sharp(f, period); yd = get_yield(f, period)
    return (sh is not None and yd is not None and
            f.get("aum") and f["aum"] > 0 and
            f.get("fam_aek") and f["fam_aek"] > 0)


def pass_filter(f, period, sharp_min, fam_aek_min_oku):
    sh = get_sharp(f, period)
    if sh is None or sh < sharp_min: return False
    if not f.get("fam_aek") or f["fam_aek"] < fam_aek_min_oku * 1e8: return False
    return True


def rank_score(values):
    valid = [(v, i) for i, v in enumerate(values) if v is not None]
    valid.sort(reverse=True)
    n = len(valid)
    scores = [None] * len(values)
    for rk, (_, idx) in enumerate(valid):
        scores[idx] = 100.0 if n == 1 else 100 - (100 - 1) * rk / (n - 1)
    return scores


def compute_amc_scores(funds):
    sec_amc_aum = defaultdict(float)
    sec_amc_set = defaultdict(set)
    for f in funds:
        if not f.get("amc_nm") or not f.get("fam_aek"): continue
        sec = f["sector_group"]
        sec_amc_aum[(sec, f["amc_nm"])] += f["fam_aek"]
        sec_amc_set[sec].add(f["amc_nm"])
    by_sec_amc = {}
    for sec, amc_set in sec_amc_set.items():
        lst = [(amc, sec_amc_aum[(sec, amc)]) for amc in amc_set]
        lst.sort(key=lambda x: -x[1])
        n = len(lst)
        for rk, (amc, _) in enumerate(lst):
            by_sec_amc[(sec, amc)] = 100.0 if n == 1 else 100 - (100 - 1) * rk / (n - 1)
    return by_sec_amc


def simulate(period, sharp_min, fam_aek_min, weights):
    funds = [f for f in SNAPSHOT["funds"] if pass_filter(f, period, sharp_min, fam_aek_min)]
    scorable = [f for f in funds if is_scorable(f, period)]
    if not scorable: return None
    amc_scores = compute_amc_scores(scorable)
    aum_scores = rank_score([f["fam_aek"] for f in scorable])
    yld_scores = rank_score([get_yield(f, period) for f in scorable])
    sharp_scores = rank_score([get_sharp(f, period) for f in scorable])

    scored = []
    for i, f in enumerate(scorable):
        amc_sc = amc_scores.get((f["sector_group"], f["amc_nm"]))
        if amc_sc is None or aum_scores[i] is None or yld_scores[i] is None or sharp_scores[i] is None:
            continue
        total = (weights[0] * aum_scores[i] + weights[1] * yld_scores[i] +
                 weights[2] * sharp_scores[i] + weights[3] * amc_sc)
        scored.append((total, f["amc_nm"], f["sector_group"]))

    if not scored: return None
    scored.sort(reverse=True)

    # sector 별 ranking + 한투 진입
    by_sec = defaultdict(list)
    for t, amc, sec in scored:
        by_sec[sec].append((t, amc))

    # 각 sector 별 한투 top1/top3/top5 진입 + 한투 평균 percentile
    sector_stats = {}
    for sec in SECTORS:
        lst = by_sec.get(sec, [])
        if not lst:
            sector_stats[sec] = None
            continue
        n = len(lst)
        hanto_positions = [(rk + 1) for rk, (t, amc) in enumerate(lst) if amc == HANTO]
        sector_stats[sec] = {
            "n": n,
            "n_hanto": len(hanto_positions),
            "top1": sum(1 for p in hanto_positions if p <= 1),
            "top3": sum(1 for p in hanto_positions if p <= 3),
            "top5": sum(1 for p in hanto_positions if p <= 5),
            "best_rank": min(hanto_positions) if hanto_positions else None,
            "avg_percentile": (sum(p for p in hanto_positions) / len(hanto_positions) / n * 100) if hanto_positions else None,
        }

    # 종합 지표
    secs_with_hanto = sum(1 for s in sector_stats.values() if s and s["n_hanto"] > 0)
    secs_top5 = sum(1 for s in sector_stats.values() if s and s["top5"] >= 1)
    secs_top3 = sum(1 for s in sector_stats.values() if s and s["top3"] >= 1)
    secs_top1 = sum(1 for s in sector_stats.values() if s and s["top1"] >= 1)
    avg_best_rank = sum(s["best_rank"] for s in sector_stats.values() if s and s["best_rank"]) / max(1, secs_with_hanto)

    return {
        "sector_stats": sector_stats,
        "secs_with_hanto": secs_with_hanto,
        "secs_top1": secs_top1, "secs_top3": secs_top3, "secs_top5": secs_top5,
        "avg_best_rank": avg_best_rank,
    }


# 시뮬레이션 grid
periods = ["1Y", "2Y", "3Y"]
sharp_mins = [0.0, 0.5, 1.0, 1.5]
fam_mins = [0, 100, 300, 500, 1000]
weight_sets = [
    ("균등 25/25/25/25", (0.25, 0.25, 0.25, 0.25)),
    ("AUM↑ 40/20/20/20", (0.40, 0.20, 0.20, 0.20)),
    ("수익↑ 20/40/20/20", (0.20, 0.40, 0.20, 0.20)),
    ("샤프↑ 20/20/40/20", (0.20, 0.20, 0.40, 0.20)),
    ("운용사↑ 20/20/20/40", (0.20, 0.20, 0.20, 0.40)),
    ("AUM+운용사 35/15/15/35", (0.35, 0.15, 0.15, 0.35)),
    ("운용사 50 30/10/10/50", (0.30, 0.10, 0.10, 0.50)),
    ("운용사 70 10/10/10/70", (0.10, 0.10, 0.10, 0.70)),
    ("AUM 50 50/15/15/20", (0.50, 0.15, 0.15, 0.20)),
    ("AUM+샤프 40/10/40/10", (0.40, 0.10, 0.40, 0.10)),
    ("AUM+운용사 45/10/10/35", (0.45, 0.10, 0.10, 0.35)),
    ("AUM+수익 40/30/20/10", (0.40, 0.30, 0.20, 0.10)),
    ("AUM+운용사 50/5/5/40", (0.50, 0.05, 0.05, 0.40)),
    ("매우균형 30/25/25/20", (0.30, 0.25, 0.25, 0.20)),
]

# 모든 조합 평가
results = []
for p in periods:
    for sm in sharp_mins:
        for fm in fam_mins:
            for wname, w in weight_sets:
                r = simulate(p, sm, fm, w)
                if r is None: continue
                results.append({
                    "period": p, "sharp": sm, "fam": fm, "weights": wname, "w": w,
                    **r,
                })

# 정렬 기준: secs_top5 desc → secs_top3 desc → secs_top1 desc → avg_best_rank asc
results.sort(key=lambda x: (-x["secs_top5"], -x["secs_top3"], -x["secs_top1"], x["avg_best_rank"]))

print(f"=== 시뮬레이션 완료: {len(results)} 조합 ===")
print(f"{'순위':>3} {'period':>5} {'샤프':>5} {'family':>7} {'가중치':<24} "
      f"{'top1섹':>5} {'top3섹':>5} {'top5섹':>5} {'한투섹':>5} {'평균랭':>5}")
print("-" * 110)
for i, r in enumerate(results[:20], 1):
    print(f"{i:>3} {r['period']:>5} {r['sharp']:>5.1f} {r['fam']:>6,}억 {r['weights']:<24} "
          f"{r['secs_top1']:>5} {r['secs_top3']:>5} {r['secs_top5']:>5} {r['secs_with_hanto']:>5} {r['avg_best_rank']:>5.1f}")

# Top 5 detail
print("\n=== Top 5 detail ===")
for i, r in enumerate(results[:5], 1):
    print(f"\n#{i} {r['period']} / sharp≥{r['sharp']:.1f} / family≥{r['fam']}억 / {r['weights']}")
    print(f"   top1 sector {r['secs_top1']}/6 · top3 sector {r['secs_top3']}/6 · top5 sector {r['secs_top5']}/6 · 한투 진입 sector {r['secs_with_hanto']}/6")
    for sec in SECTORS:
        st = r["sector_stats"].get(sec)
        if st is None:
            print(f"     {sec:>6s}: 통과 없음")
        elif st["n_hanto"] == 0:
            print(f"     {sec:>6s}: {st['n']:>3}개 / 한투 0건")
        else:
            print(f"     {sec:>6s}: {st['n']:>3}개 / 한투 {st['n_hanto']}건 · best rank {st['best_rank']} · top5 {st['top5']}")
