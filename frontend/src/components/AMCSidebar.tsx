import type { ScoredFund } from "../types";
import { formatAUM, formatNum } from "../lib/scoring";

interface Props {
  funds: ScoredFund[];          // 필터 통과 펀드들
  sector: string;                // "전체" 또는 sector 명
  bySectorAmc: Map<string, number>;
  byAmcOverall: Map<string, number>;
  aumBySectorAmc: Map<string, number>;
  aumByAmcOverall: Map<string, number>;
}

const HANTO = "한국투자신탁운용";

export function AMCSidebar({ funds, sector, bySectorAmc, byAmcOverall, aumBySectorAmc, aumByAmcOverall }: Props) {
  const isOverall = sector === "전체" || sector === "TDF";

  // 현재 sector/TDF + 표시 펀드 안의 unique amc 추출
  const amcSet = new Set<string>();
  const cntMap = new Map<string, number>();
  funds.forEach((f) => {
    if (!f.amc_nm) return;
    if (sector === "전체") {
      // 모든 펀드
    } else if (sector === "TDF") {
      if (!f.is_tdf) return;
    } else {
      if (f.sector_group !== sector) return;
    }
    amcSet.add(f.amc_nm);
    cntMap.set(f.amc_nm, (cntMap.get(f.amc_nm) ?? 0) + 1);
  });

  const amcRanking = Array.from(amcSet).map((amc) => {
    const score = isOverall
      ? (byAmcOverall.get(amc) ?? 0)
      : (bySectorAmc.get(`${sector}|${amc}`) ?? 0);
    const aum = isOverall
      ? (aumByAmcOverall.get(amc) ?? 0)
      : (aumBySectorAmc.get(`${sector}|${amc}`) ?? 0);
    return { nm: amc, score, aum, count: cntMap.get(amc) ?? 0 };
  }).sort((a, b) => b.score - a.score);

  return (
    <div style={{
      background: "#fff", padding: 12, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      overflow: "auto", minHeight: 0,
    }}>
      <div style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>운용사 점수</strong>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
          {sector === "전체" ? "전체 통합 ranking" :
           sector === "TDF" ? "TDF 통합 ranking" :
           `${sector} sector 안 ranking`}
        </div>
        <div style={{ fontSize: 11, color: "#888" }}>
          필터 통과 펀드들의 운용사별 family AEK 합 기준
        </div>
      </div>

      {amcRanking.length === 0 ? (
        <div style={{ padding: 10, color: "#888", fontSize: 12 }}>표시할 운용사 없음</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {amcRanking.map((a, i) => {
            const isHanto = a.nm === HANTO;
            return (
              <div key={a.nm} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px",
                background: isHanto ? "#0070c0" : (i < 3 ? "#fff3e0" : "transparent"),
                color: isHanto ? "#fff" : "#222",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: isHanto ? 600 : 400,
              }}>
                <span style={{ width: 22, opacity: 0.7, fontSize: 11 }}>#{i + 1}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nm}</span>
                <span style={{ fontWeight: 700, width: 36, textAlign: "right" }}>{formatNum(a.score, 1)}</span>
                <span style={{ opacity: 0.7, fontSize: 11, width: 56, textAlign: "right" }}>{formatAUM(a.aum)}</span>
                <span style={{ opacity: 0.5, fontSize: 11, width: 24, textAlign: "right" }}>{a.count}건</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
