import { useState } from "react";
import type { ScoredFund, FilterState } from "../types";
import { formatAUM, formatPct, formatNum, getSharp, getYield } from "../lib/scoring";

interface Props {
  funds: ScoredFund[];
  sector: string;
  filter: FilterState;
}

const HANTO = "한국투자신탁운용";

export function SectorTable({ funds, sector, filter }: Props) {
  const periodLabel = filter.period === "1Y" ? "1Y" : filter.period === "3Y" ? "3Y" : "2Y";
  const [vintage, setVintage] = useState<string>("전체");
  const [groupBySub, setGroupBySub] = useState<boolean>(true);

  // sector 필터링
  let inSector = funds.filter((f) =>
    (sector === "전체" || sector === "TDF" || f.sector_group === sector) &&
    f.total_score !== null
  );
  if (sector === "TDF") inSector = inSector.filter((f) => f.is_tdf);

  // TDF 모드 + 빈티지 선택
  if (sector === "TDF" && vintage !== "전체") {
    inSector = inSector.filter((f) => f.tdf_vintage === vintage);
  }

  const filtered = inSector.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));

  // TDF 빈티지 list (현재 sector 통과 펀드의 빈티지들)
  const vintages = sector === "TDF"
    ? Array.from(new Set(funds.filter((f) => f.is_tdf && f.total_score !== null && f.tdf_vintage)
        .map((f) => f.tdf_vintage!))).sort()
    : [];

  // 그룹핑 대상: 전체/TDF 아닌 sector + 토글 ON
  const grouping = groupBySub && sector !== "전체" && sector !== "TDF";

  // 그룹별 (subclass_cd 오름차순, 그룹 내 total_score desc — 그룹별 1,2,3 순위 재시작)
  // grouping=true 시 사용. flat list = filtered.
  type Group = { cd: string; nm: string; funds: ScoredFund[] };
  const groups: Group[] = (() => {
    if (!grouping) return [];
    const m = new Map<string, Group>();
    for (const f of filtered) {
      const cd = f.subclass_cd || "ZZ_MISC";
      const nm = f.subclass_nm || "미분류";
      let g = m.get(cd);
      if (!g) { g = { cd, nm, funds: [] }; m.set(cd, g); }
      g.funds.push(f);
    }
    return Array.from(m.values()).sort((a, b) => a.cd.localeCompare(b.cd));
  })();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {sector === "TDF" && (
        <div style={{
          padding: "8px 12px", background: "#fafafa", borderBottom: "1px solid #e0e0e0",
          display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0,
        }}>
          <button onClick={() => setVintage("전체")} style={vintageBtn(vintage === "전체")}>
            전체 ({funds.filter((f) => f.is_tdf && f.total_score !== null).length})
          </button>
          {vintages.map((v) => {
            const cnt = funds.filter((f) => f.is_tdf && f.tdf_vintage === v && f.total_score !== null).length;
            return (
              <button key={v} onClick={() => setVintage(v)} style={vintageBtn(vintage === v)}>
                {v} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      <div style={{
        padding: "4px 12px", background: "#fafafa", borderBottom: "1px solid #e0e0e0",
        fontSize: 11, color: "#888", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div>
          총 <b style={{ color: "#0070c0" }}>{filtered.length}</b>개 펀드 표시 중
          {grouping && <> · <b style={{ color: "#0070c0" }}>{groups.length}</b>개 소분류</>}
        </div>
        {sector !== "전체" && sector !== "TDF" && (
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#555" }}>
            <input
              type="checkbox"
              checked={groupBySub}
              onChange={(e) => setGroupBySub(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            소분류 그룹핑 ({sector === "해외주식" ? "투자권역" : "제로인 소분류"})
          </label>
        )}
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#888" }}>표시할 펀드 없음</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingBottom: 100 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: "#f0f0f5", borderBottom: "2px solid #ccc" }}>
                <Th>순위</Th>
                {(sector === "전체" || sector === "TDF") && <Th>sector</Th>}
                {sector === "TDF" && vintage === "전체" && <Th>빈티지</Th>}
                <Th>운용사</Th>
                <Th>라인업</Th>
                <Th left>펀드명</Th>
                <Th right>클래스AUM</Th>
                <Th right>패밀리AUM</Th>
                <Th right>{periodLabel}%</Th>
                <Th right>샤프({periodLabel})</Th>
                <Th right title="패밀리AUM 기반">패밀리AUM점수</Th>
                <Th right>수익점수</Th>
                <Th right>샤프점수</Th>
                <Th right>운용사점수</Th>
                <Th right>총점</Th>
              </tr>
            </thead>
            <tbody>
              {grouping
                ? groups.flatMap((g) => [
                    <tr key={`g-${g.cd}`} style={{ background: "#eef3f9", borderTop: "2px solid #c4d4e6", borderBottom: "1px solid #c4d4e6" }}>
                      <td colSpan={13} style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#0d47a1" }}>
                        {g.nm} <span style={{ color: "#888", fontWeight: 400, fontSize: 11 }}>({g.cd}, {g.funds.length}개)</span>
                      </td>
                    </tr>,
                    ...g.funds.map((f, i) => renderRow(f, i, sector, vintage, filter)),
                  ])
                : filtered.map((f, i) => renderRow(f, i, sector, vintage, filter))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderRow(f: ScoredFund, i: number, sector: string, vintage: string, filter: FilterState) {
  const isHanto = f.amc_nm === HANTO;
  const isNonKis = f.in_kis_lineup !== "Y";
  const textColor = isNonKis ? "#c62828" : (isHanto ? "#0d47a1" : "#222");
  return (
    <tr key={f.fund_cd} style={{
      borderBottom: "1px solid #f0f0f0",
      background: isHanto ? "#e3f2fd" : (i % 2 ? "#fafafa" : "#fff"),
      color: textColor,
      fontWeight: (isHanto || isNonKis) ? 600 : 400,
    }}>
      <Td>{i + 1}</Td>
      {(sector === "전체" || sector === "TDF") && <Td>{f.sector_group}</Td>}
      {sector === "TDF" && vintage === "전체" && <Td>{f.tdf_vintage || "-"}</Td>}
      <Td>{f.amc_nm}</Td>
      <Td>{f.in_kis_lineup === "Y" ? "KIS" : "-"}</Td>
      <Td left title={f.fund_nm || ""}>{(f.fund_nm || "").slice(0, 45)}</Td>
      <Td right>{formatAUM(f.aum)}</Td>
      <Td right>{formatAUM(f.fam_aek)}</Td>
      <Td right>{formatPct(getYield(f, filter.period))}</Td>
      <Td right>{formatNum(getSharp(f, filter.period))}</Td>
      <Td right>{formatNum(f.score_aum, 1)}</Td>
      <Td right>{formatNum(f.score_yield_2y, 1)}</Td>
      <Td right>{formatNum(f.score_sharp_2y, 1)}</Td>
      <Td right>{formatNum(f.score_amc_sector_y, 1)}</Td>
      <Td right><b>{formatNum(f.total_score, 2)}</b></Td>
    </tr>
  );
}

const vintageBtn = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px", fontSize: 12,
  border: "1px solid " + (active ? "#0070c0" : "#ddd"),
  background: active ? "#e3f2fd" : "#fff",
  color: active ? "#0070c0" : "#555",
  fontWeight: active ? 600 : 400,
  borderRadius: 4, cursor: "pointer",
});

function Th({ children, left, right, title }: { children: React.ReactNode; left?: boolean; right?: boolean; title?: string }) {
  return (
    <th title={title} style={{
      padding: "6px 8px", fontWeight: 600, fontSize: 11, color: "#555",
      textAlign: left ? "left" : right ? "right" : "center",
    }}>{children}</th>
  );
}
function Td({ children, left, right, title }: { children: React.ReactNode; left?: boolean; right?: boolean; title?: string }) {
  return (
    <td title={title} style={{
      padding: "5px 8px",
      textAlign: left ? "left" : right ? "right" : "center",
    }}>{children}</td>
  );
}
