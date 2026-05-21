import type { ScoredFund, Period } from "../types";
import { getSharp, getYield } from "./scoring";

const HANTO = "한국투자신탁운용";
const BODY_SIZE = 10;
const NUM_FMT = "#,##0.0";

interface ExcelJSModule {
  Workbook: new () => ExcelJSWorkbook;
}
interface ExcelJSWorkbook {
  addWorksheet: (name: string) => ExcelJSWorksheet;
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
}
interface ExcelJSWorksheet {
  addRow: (row: (string | number | null)[]) => ExcelJSRow;
  getRow: (idx: number) => ExcelJSRow;
  getColumn: (idx: number) => ExcelJSColumn;
  columns: ExcelJSColumn[];
  views: { state: string; ySplit?: number }[];
  eachRow: (
    opts: { includeEmpty?: boolean },
    cb: (row: ExcelJSRow, rowNum: number) => void,
  ) => void;
}
interface ExcelJSRow {
  font: object;
  fill?: object;
  height?: number;
  getCell: (idx: number) => ExcelJSCell;
  eachCell: (
    opts: { includeEmpty?: boolean },
    cb: (cell: ExcelJSCell, colNum: number) => void,
  ) => void;
}
interface ExcelJSCell {
  value: unknown;
  font: object;
  fill?: object;
  numFmt?: string;
}
interface ExcelJSColumn {
  width?: number;
  numFmt?: string;
}

function fmtNum(v: number | null | undefined): number | null {
  return v === null || v === undefined || isNaN(v) ? null : v;
}

function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    // 한글/한자/일본어 등 CJK 영역은 1.8 너비로 가산
    w += (code >= 0x3000 && code <= 0xD7FF) ? 1.8 : 1;
  }
  return w;
}

function buildRow(f: ScoredFund, rank: number, sector: string, period: Period): (string | number | null)[] {
  const yld = getYield(f, period);
  const shp = getSharp(f, period);
  const nav_oku = f.nav ? f.nav / 1e8 : null;
  const fam_oku = f.fam_nav ? f.fam_nav / 1e8 : null;
  const row: (string | number | null)[] = [rank];
  if (sector === "전체") row.push(f.sector_group);
  if (sector === "TDF") row.push(f.tdf_vintage || "-");
  row.push(
    f.amc_nm,
    f.in_kis_lineup === "Y" ? "KIS" : "-",
    f.fund_cd,                          // 펀드코드 (Excel 전용 컬럼)
    f.fund_nm || "",
    fmtNum(nav_oku),
    fmtNum(fam_oku),
    fmtNum(yld),
    fmtNum(shp),
    fmtNum(f.score_yield_2y),
    fmtNum(f.score_sharp_2y),
    fmtNum(f.score_amc_sector_y),
    fmtNum(f.total_score),
  );
  return row;
}

function buildHeader(sector: string, period: Period): string[] {
  const p = period === "1Y" ? "1Y" : period === "3Y" ? "3Y" : "2Y";
  const h: string[] = ["순위"];
  if (sector === "전체") h.push("Sector");
  if (sector === "TDF") h.push("빈티지");
  h.push(
    "운용사", "라인업", "펀드코드", "펀드명",
    "클래스NAV(억)", "패밀리NAV(억)",
    `${p}%`, `샤프(${p})`,
    "수익점수", "샤프점수", "운용사점수", "총점",
  );
  return h;
}

function rowFont(f: ScoredFund) {
  if (f.amc_nm === HANTO) return { size: BODY_SIZE, color: { argb: "FF0D47A1" }, bold: true };
  if (f.in_kis_lineup !== "Y") return { size: BODY_SIZE, color: { argb: "FFC62828" }, bold: true };
  return { size: BODY_SIZE };
}

export async function exportFundsToExcel(
  scored: ScoredFund[],
  sectorGroups: string[],
  period: Period,
  groupBySub: boolean,
  asOfDate: string,
) {
  const ExcelJS = (await import("exceljs")) as unknown as ExcelJSModule;
  const wb = new ExcelJS.Workbook();

  const tabs = ["전체", ...sectorGroups, "TDF"];

  // 헤더 명칭별 numFmt 적용 대상 (모든 숫자 → 소수 한자리)
  const p = period === "1Y" ? "1Y" : period === "3Y" ? "3Y" : "2Y";
  const numericHeaders = new Set<string>([
    "순위",
    "클래스NAV(억)", "패밀리NAV(억)",
    `${p}%`, `샤프(${p})`,
    "수익점수", "샤프점수", "운용사점수", "총점",
  ]);

  for (const sec of tabs) {
    // sector 필터링
    let secFunds = scored.filter((f) =>
      (sec === "전체" || sec === "TDF" || f.sector_group === sec) &&
      f.total_score !== null
    );
    if (sec === "TDF") secFunds = secFunds.filter((f) => f.is_tdf);
    if (secFunds.length === 0) continue;
    secFunds.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));

    const ws = wb.addWorksheet(sec);

    // Header
    const header = buildHeader(sec, period);
    const hRow = ws.addRow(header);
    hRow.font = { bold: true };
    hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F5" } };

    // 그룹핑 적용 여부 (전체/TDF 탭 제외, 토글 ON)
    const grouping = groupBySub && sec !== "전체" && sec !== "TDF";

    if (grouping) {
      const groupMap = new Map<string, ScoredFund[]>();
      secFunds.forEach((f) => {
        const cd = f.subclass_cd || "ZZ_MISC";
        if (!groupMap.has(cd)) groupMap.set(cd, []);
        groupMap.get(cd)!.push(f);
      });
      const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      for (const [cd, items] of sortedGroups) {
        items.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
        const nm = items[0]?.subclass_nm || "미분류";
        const gRow = ws.addRow([`▶ ${nm} (${cd}, ${items.length}개)`]);
        gRow.font = { size: BODY_SIZE, bold: true, color: { argb: "FF0D47A1" } } as object;
        gRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF3F9" } };
        items.forEach((f, i) => {
          const r = ws.addRow(buildRow(f, i + 1, sec, period));
          r.font = rowFont(f) as object;
        });
      }
    } else {
      secFunds.forEach((f, i) => {
        const r = ws.addRow(buildRow(f, i + 1, sec, period));
        r.font = rowFont(f) as object;
      });
    }

    // 숫자 컬럼 numFmt
    header.forEach((h, idx) => {
      if (numericHeaders.has(h)) {
        ws.getColumn(idx + 1).numFmt = NUM_FMT;
      }
    });

    // 컬럼 너비 자동 맞춤 (콘텐츠 visual width 기반)
    const colMax: number[] = header.map((h) => visualWidth(h));
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return; // header 이미 반영
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const v = cell.value;
        const s = v === null || v === undefined ? ""
          : typeof v === "number" ? v.toFixed(1)
          : String(v);
        const w = visualWidth(s);
        const i = colNum - 1;
        if (i < colMax.length && w > colMax[i]) colMax[i] = w;
      });
    });
    colMax.forEach((w, i) => {
      ws.getColumn(i + 1).width = Math.max(6, Math.min(50, w + 2));
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fund_list_${asOfDate || "snapshot"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
