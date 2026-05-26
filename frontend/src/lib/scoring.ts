import type { Fund, ScoredFund, Weights, FilterState, Period } from "../types";

// period 별 sharp/yield getter
export function getSharp(f: Fund, p: Period): number | null {
  return p === "1Y" ? f.sharp_1y : p === "3Y" ? f.sharp_3y : f.sharp_2y;
}
export function getYield(f: Fund, p: Period): number | null {
  return p === "1Y" ? f.yield_1y : p === "3Y" ? f.yield_3y : f.yield_2y;
}

// 점수 계산 가능 조건 — period 에 따라 변동 (NAV 기준)
export function isScorable(f: Fund, p: Period): boolean {
  const sh = getSharp(f, p);
  const yd = getYield(f, p);
  return (
    sh !== null && !isNaN(sh) &&
    yd !== null && !isNaN(yd) &&
    f.nav !== null && f.nav > 0 &&
    f.fam_nav !== null && f.fam_nav > 0
  );
}

// 사용자 필터 (정상/온라인/퇴직연금은 서버 단에서 이미 적용됨, NAV 기준)
export function passUserFilter(f: Fund, fs: FilterState): boolean {
  const sh = getSharp(f, fs.period);
  if (sh === null || sh < fs.sharp_min) return false;
  if (f.fam_nav === null || f.fam_nav < fs.fam_aek_min_oku * 1e8) return false;
  if (fs.lineup === "kis" && f.in_kis_lineup !== "Y") return false;
  if (fs.lineup === "kis_kim") {
    if (f.in_kis_lineup !== "Y" && f.amc_nm !== "한국투자신탁운용") return false;
  }
  return true;
}

// 1~100 linear ranking score (큰 값이 100점)
export function rankScore(values: (number | null)[]): (number | null)[] {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v !== null && !isNaN(x.v as number)) as { v: number; i: number }[];
  if (valid.length === 0) return values.map(() => null);
  valid.sort((a, b) => b.v - a.v);
  const n = valid.length;
  const scores: (number | null)[] = values.map(() => null);
  valid.forEach((entry, rank) => {
    scores[entry.i] = n === 1 ? 100.0 : 100 - ((100 - 1) * rank) / (n - 1);
  });
  return scores;
}

// 운용사 점수 동적 계산:
//   각 펀드 → (sector_group, amc_nm) 키 → 그 그룹의 family NAV 합 → ranking → 1~100점
//   sector="전체" 일 때는 sector_group 무시하고 amc 별 family NAV 합 → ranking
//   ★ 운용사 점수 산정 pool 은 4 core sector (국내주식/국내채권/해외주식/해외채권) 펀드로 한정
//      혼합형/기타/TDF 펀드는 점수 산정엔 제외 (그 펀드 자체는 표시되되 소속 운용사의 4-core NAV 기준 점수 적용)
const CORE_AMC_SECTORS = new Set(["국내주식", "국내채권", "해외주식", "해외채권"]);
export function computeAmcScores(
  funds: Fund[],
  scope: "sector" | "overall"
): {
  bySectorAmc: Map<string, number>;       // "sector|amc" → score
  byAmcOverall: Map<string, number>;       // amc → score (전체 sector 통합)
  aumBySectorAmc: Map<string, number>;     // "sector|amc" → family NAV 합
  aumByAmcOverall: Map<string, number>;    // amc → family NAV 합 (전체)
} {
  // sector × amc family NAV 합 (4 core sector 만 카운트)
  const sectorAmcAum = new Map<string, number>();
  const sectorAmcSet = new Map<string, Set<string>>(); // sector → amc set
  for (const f of funds) {
    if (!CORE_AMC_SECTORS.has(f.sector_group)) continue;
    if (!f.amc_nm || !f.fam_nav) continue;
    const key = `${f.sector_group}|${f.amc_nm}`;
    sectorAmcAum.set(key, (sectorAmcAum.get(key) ?? 0) + f.fam_nav);
    if (!sectorAmcSet.has(f.sector_group)) sectorAmcSet.set(f.sector_group, new Set());
    sectorAmcSet.get(f.sector_group)!.add(f.amc_nm);
  }
  // sector 안에서 amc ranking
  const bySectorAmc = new Map<string, number>();
  for (const [sector, amcSet] of sectorAmcSet) {
    const list = Array.from(amcSet).map((amc) => ({
      amc, aum: sectorAmcAum.get(`${sector}|${amc}`) ?? 0,
    })).sort((a, b) => b.aum - a.aum);
    const n = list.length;
    list.forEach((x, rk) => {
      const sc = n === 1 ? 100.0 : 100 - ((100 - 1) * rk) / (n - 1);
      bySectorAmc.set(`${sector}|${x.amc}`, sc);
    });
  }
  // 전체 통합 amc NAV 합 (4 core sector 만 카운트)
  const amcOverallAum = new Map<string, number>();
  for (const f of funds) {
    if (!CORE_AMC_SECTORS.has(f.sector_group)) continue;
    if (!f.amc_nm || !f.fam_nav) continue;
    amcOverallAum.set(f.amc_nm, (amcOverallAum.get(f.amc_nm) ?? 0) + f.fam_nav);
  }
  const byAmcOverall = new Map<string, number>();
  const overallList = Array.from(amcOverallAum.entries())
    .map(([amc, aum]) => ({ amc, aum }))
    .sort((a, b) => b.aum - a.aum);
  const n = overallList.length;
  overallList.forEach((x, rk) => {
    byAmcOverall.set(x.amc, n === 1 ? 100.0 : 100 - ((100 - 1) * rk) / (n - 1));
  });
  return { bySectorAmc, byAmcOverall, aumBySectorAmc: sectorAmcAum, aumByAmcOverall: amcOverallAum };
}

export function scoreFunds(
  funds: Fund[],
  weights: Weights,
  amcMaps: ReturnType<typeof computeAmcScores>,
  amcScoreMode: "sector" | "overall",
  period: Period
): ScoredFund[] {
  // 점수 계산 가능 펀드만 ranking pool 에 포함
  const scorable = funds.map((f) => isScorable(f, period));
  const scorableFunds = funds.filter((_, i) => scorable[i]);
  const yldScores = rankScore(scorableFunds.map((f) => getYield(f, period)));
  const sharpScores = rankScore(scorableFunds.map((f) => getSharp(f, period)));
  // 동적 운용사 점수 (sector_group 기준 또는 overall) — NAV 기반
  const amcScores: (number | null)[] = scorableFunds.map((f) => {
    if (!f.amc_nm) return null;
    if (amcScoreMode === "overall") {
      return amcMaps.byAmcOverall.get(f.amc_nm) ?? null;
    }
    return amcMaps.bySectorAmc.get(`${f.sector_group}|${f.amc_nm}`) ?? null;
  });

  const scoredMap = new Map<string, ScoredFund>();
  scorableFunds.forEach((f, i) => {
    const sYld = yldScores[i];
    const sSharp = sharpScores[i];
    const sAmc = amcScores[i];
    const allOk = [sYld, sSharp, sAmc].every((s) => s !== null);
    const total = allOk
      ? weights.yield_2y * (sYld as number) +
        weights.sharp_2y * (sSharp as number) +
        weights.amc_sector_y * (sAmc as number)
      : null;
    scoredMap.set(f.fund_cd, {
      ...f,
      score_yield_2y: sYld,
      score_sharp_2y: sSharp,
      score_amc_sector_y: sAmc,
      total_score: total,
      rank_overall: null,
      rank_sector: null,
    });
  });

  // 전체 ranking (점수 있는 펀드만)
  const sortedAll = Array.from(scoredMap.values())
    .filter((f) => f.total_score !== null)
    .sort((a, b) => (b.total_score ?? -Infinity) - (a.total_score ?? -Infinity));
  sortedAll.forEach((f, i) => { f.rank_overall = i + 1; });

  // sector 별 ranking
  const sectorMap = new Map<string, ScoredFund[]>();
  sortedAll.forEach((f) => {
    if (!sectorMap.has(f.sector_group)) sectorMap.set(f.sector_group, []);
    sectorMap.get(f.sector_group)!.push(f);
  });
  sectorMap.forEach((list) => {
    list.sort((a, b) => (b.total_score ?? -Infinity) - (a.total_score ?? -Infinity));
    list.forEach((f, i) => { f.rank_sector = i + 1; });
  });

  // 모든 펀드 반환 (점수 미가용은 NULL)
  return funds.map((f) => scoredMap.get(f.fund_cd) ?? {
    ...f,
    score_yield_2y: null, score_sharp_2y: null,
    score_amc_sector_y: null, total_score: null,
    rank_overall: null, rank_sector: null,
  });
}

export function formatAUM(v: number | null): string {
  if (v === null) return "-";
  return `${(v / 1e8).toLocaleString("ko", { maximumFractionDigits: 0 })}억`;
}
export function formatPct(v: number | null, digits = 2): string {
  if (v === null) return "-";
  return `${v.toFixed(digits)}%`;
}
export function formatNum(v: number | null, digits = 2): string {
  if (v === null) return "-";
  return v.toFixed(digits);
}
