import { useEffect, useMemo, useState } from "react";
import type { Snapshot, Weights, ScoredFund, FilterState } from "./types";
import { DEFAULT_FILTER, DEFAULT_WEIGHTS } from "./types";
import { scoreFunds, passUserFilter, computeAmcScores } from "./lib/scoring";
import { WeightsSlider } from "./components/WeightsSlider";
import { FilterPanel } from "./components/FilterPanel";
import { SectorTable } from "./components/SectorTable";
import { AMCSidebar } from "./components/AMCSidebar";
import { AdminTab } from "./components/AdminTab";
import { exportFundsToExcel } from "./lib/excelExport";

const IS_DEV = import.meta.env.DEV;

interface DateIndex {
  dates: { as_of: string; label: string }[];
  default: string | null;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [dateIndex, setDateIndex] = useState<DateIndex | null>(null);
  const [activeDate, setActiveDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [activeSector, setActiveSector] = useState<string>("전체");
  const [groupBySub, setGroupBySub] = useState<boolean>(true);

  // 사용 가능한 날짜 list 먼저 로드 (정적 JSON)
  useEffect(() => {
    fetch("./snapshots/snapshot_index.json")
      .then((r) => r.json())
      .then((d: DateIndex) => {
        setDateIndex(d);
        if (d.default && !activeDate) setActiveDate(d.default);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // activeDate 변경 시 해당 snapshot fetch (정적 JSON)
  useEffect(() => {
    if (!activeDate) return;
    fetch(`./snapshots/snapshot_${activeDate}.json`)
      .then(async (r) => {
        const text = await r.text();
        if (!text) throw new Error("snapshot 응답이 비어있습니다");
        try { return JSON.parse(text); }
        catch { throw new Error("JSON parse 실패"); }
      })
      .then((d) => setSnapshot(d))
      .catch((e) => setError(e.message || String(e)));
  }, [activeDate]);

  // 필터 통과 펀드 (점수 산출 + 운용사 ranking 기반)
  const filteredFunds = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.funds.filter((f) => passUserFilter(f, filter));
  }, [snapshot, filter]);

  // 운용사 점수 동적 계산 (필터 통과 펀드 기준)
  const amcMaps = useMemo(
    () => computeAmcScores(filteredFunds, "sector"),
    [filteredFunds]
  );

  // 운용사 점수는 항상 전체 기준 (sector 별 분리 안 함)
  const scored: ScoredFund[] = useMemo(() => {
    return scoreFunds(filteredFunds, weights, amcMaps, "overall", filter.period);
  }, [filteredFunds, weights, amcMaps, filter.period]);

  if (error) return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ color: "#c62828" }}>FastAPI 연결 실패</h2>
      <pre style={{ background: "#fff3f3", padding: 12, borderRadius: 4, fontSize: 12 }}>{error}</pre>
    </div>
  );
  if (!snapshot) return <div style={{ padding: 20 }}>Loading ...</div>;

  const tabs = ["전체", ...snapshot.sector_groups, "TDF", ...(IS_DEV ? ["Admin"] : [])];
  const isAdminTab = activeSector === "Admin";

  return (
    <div style={{
      height: "100vh", padding: 8, display: "flex", flexDirection: "column", gap: 8,
      overflow: "hidden",
    }}>
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 16 }}>퇴직연금 펀드 평가</h1>
        {dateIndex && dateIndex.dates.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#555" }}>기준일:</span>
            <select value={activeDate} onChange={(e) => setActiveDate(e.target.value)}
              style={{ padding: "3px 6px", fontSize: 12, border: "1px solid #ccc", borderRadius: 4 }}>
              {dateIndex.dates.map((d) => (
                <option key={d.as_of} value={d.as_of}>{d.label}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ fontSize: 11, color: "#888" }}>
          {snapshot.source_file} · {snapshot.generated_at.slice(0, 19)} · {snapshot.funds.length} 펀드
        </div>
        <button
          onClick={() => {
            setWeights(DEFAULT_WEIGHTS);
            setFilter(DEFAULT_FILTER);
          }}
          title="기본 설정으로 초기화 (한투★: 2Y / sharp≥1.0 / family NAV≥300억 / 수익45·샤프25·운용사30)"
          style={{
            marginLeft: "auto",
            padding: "5px 12px", fontSize: 12,
            border: "1px solid #999", background: "#fff",
            color: "#555", borderRadius: 4, cursor: "pointer",
          }}>
          ↻ 초기화
        </button>
        <button
          onClick={() => exportFundsToExcel(scored, snapshot.sector_groups, filter.period, groupBySub, activeDate, weights)}
          title="현재 점수/필터 + 그룹핑 (소분류 그룹핑 ON 시 그룹내 점수 재계산) 반영하여 탭별 시트로 내려받기 (펀드코드 포함)"
          style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 600,
            border: "1px solid #107c41", background: "#e8f5e9",
            color: "#107c41", borderRadius: 4, cursor: "pointer",
          }}>
          📥 Excel 내려받기
        </button>
        {!IS_DEV && (
          <a
            href="http://localhost:5174/"
            target="_blank"
            rel="noreferrer"
            title="로컬 dev 서버 (port 5174) 의 Admin 탭으로 이동. 로컬 dev 서버 + FastAPI 실행 필요."
            style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 600,
              border: "1px solid #d84315", background: "#fff3e0",
              color: "#d84315", borderRadius: 4, textDecoration: "none",
            }}>
            🔧 로컬 Admin
          </a>
        )}
      </header>

      {/* 상단: 가중치 + 상품필터 */}
      <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <WeightsSlider
          weights={weights}
          period={filter.period}
          onChange={setWeights}
        />
        <FilterPanel filter={filter} onChange={setFilter} totalCount={snapshot.funds.length} passedCount={filteredFunds.length} />
      </div>

      {/* 메인: 좌(테이블) + 우(운용사 사이드바) — Admin 탭에서는 사이드바 숨김 */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isAdminTab ? "1fr" : "1fr 320px", gap: 8 }}>
        <div style={{
          background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0,
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", overflowX: "auto", flexShrink: 0 }}>
            {tabs.map((sg) => {
              if (sg === "Admin") {
                const isActive = activeSector === sg;
                return (
                  <button key={sg} onClick={() => setActiveSector(sg)}
                    style={{
                      padding: "10px 16px", border: "none",
                      background: isActive ? "#fff3e0" : "transparent",
                      borderBottom: isActive ? "2px solid #d84315" : "2px solid transparent",
                      color: "#d84315", fontSize: 13, fontWeight: isActive ? 700 : 600,
                      cursor: "pointer", whiteSpace: "nowrap", marginLeft: "auto",
                    }}>
                    🔧 Admin
                  </button>
                );
              }
              const matchSec = (f: ScoredFund) =>
                sg === "전체" ? true :
                sg === "TDF" ? f.is_tdf :
                f.sector_group === sg;
              const cnt = scored.filter((f) => matchSec(f) && f.total_score !== null).length;
              const isActive = activeSector === sg;
              if (sg !== "전체" && cnt === 0) return null;
              return (
                <button key={sg} onClick={() => setActiveSector(sg)}
                  style={{
                    padding: "10px 16px", border: "none",
                    background: isActive ? "#fff" : "transparent",
                    borderBottom: isActive ? "2px solid #0070c0" : "2px solid transparent",
                    color: isActive ? "#0070c0" : "#555",
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                  {sg} <span style={{ color: "#888", fontSize: 11 }}>{cnt}</span>
                </button>
              );
            })}
          </div>
          {isAdminTab ? (
            <AdminTab />
          ) : (
            <SectorTable
              funds={scored}
              sector={activeSector}
              filter={filter}
              weights={weights}
              groupBySub={groupBySub}
              setGroupBySub={setGroupBySub}
            />
          )}
        </div>

        {!isAdminTab && <AMCSidebar
          funds={scored}
          sector={activeSector}
          byAmcOverall={amcMaps.byAmcOverall}
          aumByAmcOverall={amcMaps.aumByAmcOverall}
        />}
      </div>
    </div>
  );
}
