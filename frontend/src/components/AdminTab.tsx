import { useState } from "react";

interface StepResult {
  label: string;
  cmd: string;
  returncode: number;
  stdout: string;
  stderr: string;
  elapsed_sec: number;
}
interface BuildResp {
  ok: boolean;
  date?: string;
  stage?: string;
  steps: StepResult[];
}

const API_BASE = "http://localhost:8001";

function todayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function AdminTab() {
  const [date, setDate] = useState<string>(todayYYYYMMDD());
  const [push, setPush] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BuildResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmtDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`;

  async function onRun() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/admin/build_snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, push }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t}`);
      }
      const j: BuildResp = await r.json();
      setResult(j);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto" }}>
      <h2 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#d84315" }}>🔧 Admin — Snapshot Fetch</h2>
      <div style={{ background: "#fff3e0", padding: 10, borderRadius: 4, fontSize: 12, color: "#5d4037", marginBottom: 16, lineHeight: 1.6 }}>
        선택한 기준일로 Oracle KITM/INST1 fetch → <code>frontend/public/snapshots/</code> 동기화 → (옵션) git push.<br />
        <b>전제</b>: FastAPI (port 8001) 실행 중 + Oracle 사내망 접근 가능.<br />
        <b>소요</b>: 약 30~90초 (fetch 단계).
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          기준일
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="YYYYMMDD"
            style={{ padding: "4px 8px", fontSize: 13, border: "1px solid #ccc", borderRadius: 4, width: 110 }}
          />
          <span style={{ color: "#888", fontSize: 12 }}>= {fmtDate}</span>
        </label>
        <button onClick={() => setDate(todayYYYYMMDD())}
          style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #999", background: "#fff", borderRadius: 4, cursor: "pointer" }}>
          오늘
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          fetch+sync 후 git push (Cloudflare 자동 배포)
        </label>
      </div>

      <button
        onClick={onRun}
        disabled={running || date.length !== 8}
        style={{
          padding: "8px 20px", fontSize: 14, fontWeight: 600,
          border: "1px solid " + (running ? "#999" : "#d84315"),
          background: running ? "#eee" : "#ff5722",
          color: running ? "#666" : "#fff",
          borderRadius: 4, cursor: running ? "wait" : "pointer",
        }}
      >
        {running ? "⏳ 실행 중 ..." : "🚀 Fetch & Deploy"}
      </button>

      {error && (
        <pre style={{ marginTop: 16, background: "#ffebee", padding: 10, borderRadius: 4, fontSize: 12, color: "#c62828", whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            padding: "8px 12px", borderRadius: 4, fontSize: 13, fontWeight: 600,
            background: result.ok ? "#e8f5e9" : "#ffebee",
            color: result.ok ? "#2e7d32" : "#c62828",
            marginBottom: 10,
          }}>
            {result.ok ? `✅ 성공 — ${result.date} snapshot 반영 완료` : `❌ 실패 — ${result.stage} 단계`}
          </div>
          {result.steps.map((s, i) => (
            <div key={i} style={{
              marginBottom: 8, border: "1px solid #ddd", borderRadius: 4,
              borderLeft: `4px solid ${s.returncode === 0 ? "#4caf50" : "#f44336"}`,
            }}>
              <div style={{ padding: "6px 10px", background: "#f5f5f5", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <b>{s.returncode === 0 ? "✓" : "✗"} {s.label}</b>
                <span style={{ color: "#888" }}>{s.elapsed_sec}s · exit {s.returncode}</span>
              </div>
              <div style={{ padding: "4px 10px", fontSize: 11, color: "#666", background: "#fafafa", fontFamily: "monospace" }}>
                $ {s.cmd}
              </div>
              {s.stdout && (
                <pre style={{ margin: 0, padding: "4px 10px", fontSize: 11, background: "#fff", maxHeight: 200, overflow: "auto" }}>{s.stdout}</pre>
              )}
              {s.stderr && (
                <pre style={{ margin: 0, padding: "4px 10px", fontSize: 11, background: "#fff8e1", color: "#e65100", maxHeight: 150, overflow: "auto" }}>{s.stderr}</pre>
              )}
            </div>
          ))}
          {result.ok && (
            <div style={{ marginTop: 12, padding: 10, background: "#e3f2fd", borderRadius: 4, fontSize: 12, color: "#0d47a1" }}>
              Cloudflare Pages 빌드 시작됨. 1~2분 후 라이브 dropdown에 <b>{result.date}</b> 추가.<br />
              👉 <a href="https://fund-eval.pages.dev/" target="_blank" rel="noreferrer">https://fund-eval.pages.dev/</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
