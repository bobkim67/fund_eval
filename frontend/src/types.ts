export interface Fund {
  fund_cd: string;
  amc_nm: string;
  fund_nm: string | null;
  kis_type: string | null;
  sector_group: string;
  subclass_cd: string | null;
  subclass_nm: string | null;
  in_kis_lineup: string | null;
  class_gb: string | null;
  tmnt_gb: string | null;
  haeji_normal: boolean;
  is_online: boolean;
  is_pension: boolean;
  filter_pass: boolean;
  aum: number | null;
  nav: number | null;
  fam_aek: number | null;
  fam_nav: number | null;
  fam_size: number | null;
  yield_2y: number | null;
  yield_3y: number | null;
  sharp_2y: number | null;
  sharp_3y: number | null;
  ir_2y: number | null;
  te_2y: number | null;
  alpha_3y: number | null;
  beta_3y: number | null;
  amc_sector_aum_y: number | null;
  amc_sector_score_y: number | null;
  fee_amc: number | null;
  fee_distb: number | null;
  fee_total: number | null;
  is_tdf: boolean;
  tdf_vintage: string | null;
  yield_1y: number | null;
  sharp_1y: number | null;
  ir_1y: number | null;
  te_1y: number | null;
}

export type Period = "1Y" | "2Y" | "3Y";

export interface Snapshot {
  generated_at: string;
  source_file: string;
  filter_defaults: {
    sharp_2y_min: number;
    fam_aek_min: number;
    require_online: boolean;
    require_pension: boolean;
    require_normal: boolean;
  };
  score_defaults: {
    aum_weight: number;
    yield_2y_weight: number;
    sharp_2y_weight: number;
    amc_sector_y_weight: number;
  };
  sector_groups: string[];
  funds: Fund[];
}

export interface Weights {
  yield_2y: number;
  sharp_2y: number;
  amc_sector_y: number;
}

// 서버 단에서 이미 정상+온라인+퇴직연금 적용됨
export interface FilterState {
  period: Period;                                // 평가 기간 (1Y/2Y/3Y)
  sharp_min: number;                             // 해당 period SHARP >= x
  fam_aek_min_oku: number;                       // family NAV >= x억 (변수명은 구버전 유지, 의미는 NAV)
  lineup: "all" | "kis" | "kis_kim";             // 전체 / KIS 라인업 / KIS + 한투(KIM)
}

// 기본 = 한투★ 셋팅 (2Y / sharp≥1.3 / family NAV≥300억 / 라인업 전체)
export const DEFAULT_FILTER: FilterState = {
  period: "2Y",
  sharp_min: 1.3,
  fam_aek_min_oku: 300,
  lineup: "all",
};

// 기본 가중치 = 한투★ (수익 45 / 샤프 25 / 운용사 30) — NAV 슬롯 제거
export const DEFAULT_WEIGHTS: Weights = {
  yield_2y: 0.45, sharp_2y: 0.25, amc_sector_y: 0.30,
};

export interface ScoredFund extends Fund {
  score_yield_2y: number | null;
  score_sharp_2y: number | null;
  score_amc_sector_y: number | null;
  total_score: number | null;
  rank_overall: number | null;
  rank_sector: number | null;
}
