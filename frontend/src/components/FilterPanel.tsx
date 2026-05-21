import type { FilterState } from "../types";

interface Props {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  passedCount: number;
}

export function FilterPanel({ filter, onChange, totalCount, passedCount }: Props) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...filter, [k]: v });

  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ fontSize: 15 }}>상품 필터</strong>
        <span style={{ fontSize: 11, color: "#888" }}>
          통과 <b style={{ color: "#0070c0" }}>{passedCount}</b> / {totalCount} · 서버 pre-filter (정상+온라인+퇴직연금) 후
        </span>
      </div>

      {/* 기간 선택 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#555" }}>평가 기간</span>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {(["1Y", "2Y", "3Y"] as const).map((p) => (
            <button key={p} onClick={() => set("period", p)}
              style={{
                flex: 1, padding: "4px 6px", fontSize: 12,
                border: "1px solid " + (filter.period === p ? "#107c41" : "#ddd"),
                background: filter.period === p ? "#e8f5e9" : "#fff",
                color: filter.period === p ? "#107c41" : "#555",
                fontWeight: filter.period === p ? 600 : 400,
                borderRadius: 4, cursor: "pointer",
              }}>
              {p === "1Y" ? "1년" : p === "2Y" ? "2년" : "3년"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span>{filter.period === "1Y" ? "1년" : filter.period === "3Y" ? "3년" : "2년"} 샤프 ≥</span>
            <b>{filter.sharp_min.toFixed(2)}</b>
          </div>
          <input type="range" min={0} max={3} step={0.1} value={filter.sharp_min}
            onChange={(e) => set("sharp_min", parseFloat(e.target.value))} style={{ width: "100%" }} />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span>패밀리 AUM ≥</span>
            <b>{filter.fam_aek_min_oku.toLocaleString()}억</b>
          </div>
          <input type="range" min={0} max={1000} step={10} value={filter.fam_aek_min_oku}
            onChange={(e) => set("fam_aek_min_oku", parseInt(e.target.value))} style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#555" }}>라인업</span>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {([
            ["all", "전체"],
            ["kis", "KIS 라인업"],
            ["kis_kim", "KIS + KIM 라인업"],
          ] as const).map(([v, label]) => (
            <button key={v} onClick={() => set("lineup", v)}
              style={{
                flex: 1, padding: "4px 6px", fontSize: 11,
                border: "1px solid " + (filter.lineup === v ? "#0070c0" : "#ddd"),
                background: filter.lineup === v ? "#e3f2fd" : "#fff",
                color: filter.lineup === v ? "#0070c0" : "#555",
                fontWeight: filter.lineup === v ? 600 : 400,
                borderRadius: 4, cursor: "pointer",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
