import type { ScoredFund, Period } from "../types";
import { getSharp, getYield } from "./scoring";

const HANTO = "한국투자신탁운용";

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
  columns: ExcelJSColumn[];
  views: { state: string; ySplit?: number }[];
}
interface ExcelJSRow {
  font: object;
  fill?: object;
  getCell: (idx: number) => { font: object; fill?: object; numFmt?: string };
  height?: number;
}
interface ExcelJSColumn { width: number }

function fmtNum(v: number | null | undefined): number | null {
  return v === null || v === undefined || isNaN(v) ? null : v;
}

function buildRow(f: ScoredFund, rank: number, sector: string, period: Period): (string | number | null)[] {
  const yld = getYield(f, period);
  const shp = getSharp(f, period);
  const aum_oku = f.aum ? f.aum / 1e8 : null;
  const fam_oku = f.fam_aek ? f.fam_aek / 1e8 : null;
  const row: (string | number | null)[] = [rank];
  if (sector === "전체") row.push(f.sector_group);
  if (sector === "TDF") row.push(f.tdf_vintage || "-");
  row.push(
    f.amc_nm,
    f.in_kis_lineup === "Y" ? "KIS" : "-",
    f.fund_cd,                          // 펀드코드 (Excel 전용 컬럼)
    f.fund_nm || "",
    fmtNum(aum_oku),
    fmtNum(fam_oku),
    fmtNum(yld),
    fmtNum(shp),
    fmtNum(f.score_aum),
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
    "클래스AUM(억)", "패밀리AUM(억)",
    `${p}%`, `샤프(${p})`,
    "AUM점수", "수익점수", "샤프점수", "운용사점수", "총점",
  );
  return h;
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

    // 컬럼 너비
    const widths = sec === "전체" || sec === "TDF"
      ? [6, 10, 18, 8, 10, 38, 12, 12, 10, 10, 10, 10, 10, 10, 10]
      : [6, 18, 8, 10, 38, 12, 12, 10, 10, 10, 10, 10, 10, 10];
    widths.forEach((w, i) => { if (ws.columns[i]) ws.columns[i].width = w; });

    // 그룹핑 적용 여부 (전체/TDF 탭 제외, 토글 ON)
    const grouping = groupBySub && sec !== "전체" && sec !== "TDF";

    if (grouping) {
      // subclass_cd 별 그룹화, 코드 오름차순, 그룹 내 total_score desc, 그룹별 1,2,3 재시작
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
        // 그룹 헤더 행 (병합 없이 첫 셀에만 텍스트)
        const gRow = ws.addRow([`▶ ${nm} (${cd}, ${items.length}개)`]);
        gRow.font = { bold: true };
        const gCell = gRow.getCell(1);
        gCell.font = { bold: true, color: { argb: "FF0D47A1" } } as object;
        gCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF3F9" } };
        items.forEach((f, i) => {
          const r = ws.addRow(buildRow(f, i + 1, sec, period));
          if (f.amc_nm === HANTO) {
            r.font = { color: { argb: "FF0D47A1" }, bold: true } as object;
          } else if (f.in_kis_lineup !== "Y") {
            r.font = { color: { argb: "FFC62828" }, bold: true } as object;
          }
        });
      }
    } else {
      secFunds.forEach((f, i) => {
        const r = ws.addRow(buildRow(f, i + 1, sec, period));
        if (f.amc_nm === HANTO) {
          r.font = { color: { argb: "FF0D47A1" }, bold: true } as object;
        } else if (f.in_kis_lineup !== "Y") {
          r.font = { color: { argb: "FFC62828" }, bold: true } as object;
        }
      });
    }

    // 헤더 freeze
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
