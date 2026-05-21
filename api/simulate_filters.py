"""필터 + 가중치 조건 시뮬레이션 — 한투 우호 셋팅 탐색.

라인업 = 전체 고정. period, sharp_min, fam_aek_min, weights 4 차원 grid.
"""
import json
from collections import defaultdict
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
with open(API_DIR / "snapshot.json", encoding="utf-8") as f:
    SNAPSHOT = json.load(f)
HANTO = "한국투자신탁운용"


def get_sharp(f, p):
    return f.get(f"sharp_{p.lower()}")
def get_yield(f, p):
    return f.get(f"yield_{p.lower()}")


def is_scorable(f, period):
    sh = get_sharp(f, period); yd = get_yield(f, period)
    return (sh is not None and yd is not None and
            f.get("aum") and f["aum"] > 0 and
            f.get("fam_aek") and f["fam_aek"] > 0)


def pass_filter(f, period, sharp_min, fam_aek_min_oku, lineup):
    sh = get_sharp(f, period)
    if sh is None or sh < sharp_min: return False
    if not f.get("fam_aek") or f["fam_aek"] < fam_aek_min_oku * 1e8: return False
    if lineup == "kis" and f.get("in_kis_lineup") != "Y": return False
    if lineup == "kis_kim":
        if f.get("in_kis_lineup") != "Y" and f.get("amc_nm") != HANTO: return False
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
    """필터 통과 펀드 → (sector, amc) 별 family AEK 합 → ranking → 1~100점."""
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


def simulate(period, sharp_min, fam_aek_min, lineup, weights):
    """한 조합 시뮬레이션. 반환: (한투평균, 전체평균, 차이, n_hanto, n_total, top10_hanto, top30_hanto)"""
    funds = [f for f in SNAPSHOT["funds"] if pass_filter(f, period, sharp_min, fam_aek_min, lineup)]
    scorable = [f for f in funds if is_scorable(f, period)]
    if not scorable: return None

    amc_scores = compute_amc_scores(scorable)
    aum_scores = rank_score([f["fam_aek"] for f in scorable])
    yld_scores = rank_score([get_yield(f, period) for f in scorable])
    sharp_scores = rank_score([get_sharp(f, period) for f in scorable])

    totals = []
    for i, f in enumerate(scorable):
        amc_sc = amc_scores.get((f["sector_group"], f["amc_nm"]))
        if amc_sc is None or aum_scores[i] is None or yld_scores[i] is None or sharp_scores[i] is None:
            continue
        total = (weights[0] * aum_scores[i] +
                 weights[1] * yld_scores[i] +
                 weights[2] * sharp_scores[i] +
                 weights[3] * amc_sc)
        totals.append((total, f["amc_nm"]))

    if not totals: return None
    totals.sort(reverse=True)
    n = len(totals)
    hanto_scores = [t for t, a in totals if a == HANTO]
    all_avg = sum(t for t, _ in totals) / n
    hanto_avg = sum(hanto_scores) / len(hanto_scores) if hanto_scores else 0
    top10_hanto = sum(1 for t, a in totals[:10] if a == HANTO)
    top30_hanto = sum(1 for t, a in totals[:30] if a == HANTO)
    return (hanto_avg, all_avg, hanto_avg - all_avg, len(hanto_scores), n, top10_hanto, top30_hanto)


# 시뮬레이션 grid
periods = ["1Y", "2Y", "3Y"]
sharp_mins = [0.0, 0.5, 1.0, 1.5]
fam_mins = [0, 100, 300, 500, 1000]
# 가중치 조합 (AUM / YIELD / SHARP / AMC)
weight_sets = [
    ("균등", (0.25, 0.25, 0.25, 0.25)),
    ("AUM↑", (0.40, 0.20, 0.20, 0.20)),
    ("수익↑", (0.20, 0.40, 0.20, 0.20)),
    ("샤프↑", (0.20, 0.20, 0.40, 0.20)),
    ("운용사↑", (0.20, 0.20, 0.20, 0.40)),
    ("AUM+운용사", (0.35, 0.15, 0.15, 0.35)),
    ("운용사 최대", (0.10, 0.10, 0.10, 0.70)),
    ("AUM 최대", (0.70, 0.10, 0.10, 0.10)),
    ("샤프+운용사", (0.10, 0.10, 0.40, 0.40)),
    ("수익+운용사", (0.10, 0.40, 0.10, 0.40)),
    ("샤프 최대", (0.10, 0.10, 0.70, 0.10)),
    ("수익 최대", (0.10, 0.70, 0.10, 0.10)),
    ("AUM+샤프", (0.40, 0.10, 0.40, 0.10)),
]

results = []
for p in periods:
    for sm in sharp_mins:
        for fm in fam_mins:
            for wname, w in weight_sets:
                r = simulate(p, sm, fm, "all", w)
                if r is None: continue
                hav, aav, diff, n_h, n_t, t10, t30 = r
                results.append({
                    "period": p, "sharp": sm, "fam": fm, "weights": wname,
                    "h_avg": hav, "a_avg": aav, "diff": diff,
                    "n_h": n_h, "n_t": n_t, "t10": t10, "t30": t30, "w": w,
                })

# 한투 우호도 정렬 (한투 평균 - 전체 평균 차이, 동률 시 t10 한투 수)
results.sort(key=lambda x: (-x["diff"], -x["t10"], -x["h_avg"]))

print(f"=== 시뮬레이션 완료: {len(results)} 조합 ===\n")
print(f"{'순위':>3} {'기간':>4} {'샤프':>5} {'family':>7} {'가중치':<14} {'한투평균':>7} {'전체평균':>7} {'차이':>6} {'한투':>6} {'top10':>5} {'top30':>5}")
print("-" * 90)
for i, r in enumerate(results[:30], 1):
    w = r["w"]
    print(f"{i:>3} {r['period']:>4} {r['sharp']:>5.1f} {r['fam']:>6,}억 {r['weights']:<14} "
          f"{r['h_avg']:>7.2f} {r['a_avg']:>7.2f} {r['diff']:>+6.2f} "
          f"{r['n_h']:>3}/{r['n_t']:<3} {r['t10']:>5} {r['t30']:>5}")

print("\n=== 최상위 5 조합 detail ===")
for i, r in enumerate(results[:5], 1):
    w = r["w"]
    print(f"\n#{i} {r['period']} 기간 / sharp≥{r['sharp']:.1f} / family≥{r['fam']}억 / 가중치 {r['weights']}")
    print(f"   AUM={w[0]:.0%} YIELD={w[1]:.0%} SHARP={w[2]:.0%} 운용사={w[3]:.0%}")
    print(f"   한투 평균 {r['h_avg']:.2f} vs 전체 평균 {r['a_avg']:.2f} (차이 {r['diff']:+.2f})")
    print(f"   한투 통과 {r['n_h']}/{r['n_t']} · 상위 10 내 한투 {r['t10']} · 상위 30 내 {r['t30']}")
