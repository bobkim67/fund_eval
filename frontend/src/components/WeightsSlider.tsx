import type { Weights, Period } from "../types";

interface Props {
  weights: Weights;
  period: Period;
  onChange: (w: Weights) => void;
}

const PERIOD_LABEL: Record<Period, string> = { "1Y": "1년", "2Y": "2년", "3Y": "3년" };

export function WeightsSlider({ weights, period, onChange }: Props) {
  const pLabel = PERIOD_LABEL[period];
  const LABELS: { key: keyof Weights; label: string; color: string }[] = [
    { key: "aum", label: "패밀리 AUM", color: "#0070c0" },
    { key: "yield_2y", label: `${pLabel} 수익률`, color: "#107c41" },
    { key: "sharp_2y", label: `${pLabel} 샤프`, color: "#bf6f00" },
    { key: "amc_sector_y", label: "운용사 점수", color: "#7c4dff" },
  ];
  const total = weights.aum + weights.yield_2y + weights.sharp_2y + weights.amc_sector_y;
  const totalPct = (total * 100).toFixed(0);
  const isValid = Math.abs(total - 1.0) < 0.01;

  const handleChange = (key: keyof Weights, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const normalize = () => {
    const t = total || 1;
    onChange({
      aum: weights.aum / t,
      yield_2y: weights.yield_2y / t,
      sharp_2y: weights.sharp_2y / t,
      amc_sector_y: weights.amc_sector_y / t,
    });
  };

  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 15 }}>가중치 (합 100%)</strong>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: isValid ? "#107c41" : "#c62828", fontWeight: 600 }}>합계 {totalPct}%</span>
          {!isValid && (
            <button onClick={normalize} style={btn}>정규화</button>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {LABELS.map(({ key, label, color }) => {
          const pct = (weights[key] * 100).toFixed(0);
          return (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{pct}%</span>
              </div>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={weights[key]}
                onChange={(e) => handleChange(key, parseFloat(e.target.value))}
                style={{ accentColor: color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "4px 10px", fontSize: 12, border: "1px solid #c62828", background: "#fff",
  color: "#c62828", borderRadius: 4, cursor: "pointer",
};
