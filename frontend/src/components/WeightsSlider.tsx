import type { Weights, Period } from "../types";

interface Props {
  weights: Weights;
  period: Period;
  onChange: (w: Weights) => void;
  onHantoPreset?: () => void;
  onReset?: () => void;
}

const PERIOD_LABEL: Record<Period, string> = { "1Y": "1년", "2Y": "2년", "3Y": "3년" };

export function WeightsSlider({ weights, period, onChange, onHantoPreset, onReset }: Props) {
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

  const preset = (preset: Weights) => () => onChange(preset);

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
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button style={btnPreset} onClick={preset({ aum: 0.25, yield_2y: 0.25, sharp_2y: 0.25, amc_sector_y: 0.25 })}>균등</button>
        <button style={btnPreset} onClick={preset({ aum: 0.40, yield_2y: 0.20, sharp_2y: 0.20, amc_sector_y: 0.20 })}>AUM 강조</button>
        <button style={btnPreset} onClick={preset({ aum: 0.20, yield_2y: 0.30, sharp_2y: 0.30, amc_sector_y: 0.20 })}>수익 강조</button>
        <button style={btnPreset} onClick={preset({ aum: 0.20, yield_2y: 0.20, sharp_2y: 0.20, amc_sector_y: 0.40 })}>운용사 강조</button>
        {onHantoPreset && (
          <button
            onClick={onHantoPreset}
            title="3Y / sharp≥1.5 / family≥500억 / 가중치 10·25·25·40"
            style={btnHanto}>
            한투★
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            title="기본 설정으로 초기화 (2Y / sharp≥1.0 / family≥400억 / 균등 가중)"
            style={btnReset}>
            ↻ 초기화
          </button>
        )}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "4px 10px", fontSize: 12, border: "1px solid #c62828", background: "#fff",
  color: "#c62828", borderRadius: 4, cursor: "pointer",
};
const btnPreset: React.CSSProperties = {
  padding: "4px 8px", fontSize: 12, border: "1px solid #ddd", background: "#fafafa",
  color: "#444", borderRadius: 4, cursor: "pointer",
};
const btnHanto: React.CSSProperties = {
  padding: "4px 8px", fontSize: 12,
  border: "1px solid #0070c0", background: "#e3f2fd",
  color: "#0070c0", borderRadius: 4, cursor: "pointer", fontWeight: 600,
};
const btnReset: React.CSSProperties = {
  padding: "4px 8px", fontSize: 12,
  border: "1px solid #999", background: "#fff",
  color: "#555", borderRadius: 4, cursor: "pointer", marginLeft: "auto",
};
