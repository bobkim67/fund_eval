# 퇴직연금 펀드 평가 UI

가중치 슬라이더 + Sector 별 ranking 테이블. React (Vite + TS) 클라이언트 사이드 재계산. snapshot json 정적 호스팅.

**라이브 URL: https://fund-eval.pages.dev/**

## 구조

```
web/
├── api/                                # 로컬 전용 — Cloudflare 빌드 미사용
│   ├── snapshot.py                     # xlsx → JSON 변환
│   ├── build_full_snapshot.py          # Oracle → 최신 snapshot (.gitignored — DB creds)
│   ├── build_snapshots_by_date.py      # Oracle → 날짜별 snapshot (.gitignored)
│   ├── simulate_*.py                   # 필터/sector 시뮬레이션
│   └── main.py                         # FastAPI (로컬 dev 만, 운영 미사용)
├── frontend/                           # Vite + React + TypeScript (Cloudflare Pages 본체)
│   ├── package.json
│   ├── vite.config.ts                  # base: "./" (정적 호스팅)
│   ├── public/snapshots/                # 정적 snapshot JSON (git 추적, Cloudflare 가 서빙)
│   │   ├── snapshot_20260131.json
│   │   ├── snapshot_20260228.json
│   │   ├── snapshot_20260331.json
│   │   ├── snapshot_20260430.json
│   │   ├── snapshot_20260520.json
│   │   └── snapshot_index.json
│   ├── scripts/
│   │   └── sync_snapshots.py           # api/*.json → public/snapshots/ 동기화
│   └── src/
│       ├── App.tsx                     # 메인 + 기준일 dropdown + fetch
│       ├── components/
│       │   ├── WeightsSlider.tsx       # 가중치 슬라이더 + 프리셋
│       │   ├── FilterPanel.tsx         # 기간(1/2/3Y) + 샤프/AUM + lineup
│       │   ├── SectorTable.tsx         # sector ranking 테이블
│       │   └── AMCSidebar.tsx          # 운용사 점수 사이드바
│       ├── lib/scoring.ts              # 필터 + ranking + 점수
│       └── types.ts
├── run.bat                             # 로컬 launcher
└── .gitignore                          # 민감 파일 제외 (build_*.py, .env, *.xlsx)
```

## Cloudflare Pages 배포

### 빌드 설정
| 필드 | 값 |
|---|---|
| Framework preset | React (Vite) |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | `NODE_VERSION` = `20` (선택) |

### git remote
```
https://github.com/bobkim67/fund_eval.git
```

### 운영 루프 (snapshot 갱신)
```cmd
:: 1. 로컬에서 snapshot 생성 (Oracle 접속)
cd web
run.bat
:: → 프롬프트에서 'l' (최신) 또는 'YYYYMMDD' (특정 날짜)
:: → 자동으로 sync_snapshots.py 실행되어 frontend/public/snapshots/ 동기화

:: 2. commit + push
git add frontend/public/snapshots/
git commit -m "snapshot YYYY-MM-DD"
git push

:: 3. Cloudflare Pages 가 push 감지 → 자동 빌드 → 1~2분 후 라이브
```

## 로컬 개발

```cmd
cd web
run.bat
```

자동으로:
- snapshot 갱신 prompt (`n` skip / `l` 최신 / `YYYYMMDD` 특정 날짜)
- `frontend/public/snapshots/` 동기화
- FastAPI dev 실행 (port 8001, 운영엔 미사용)
- Vite dev 실행 (port 5174)
- 브라우저 자동 열기

## 기능

### 기준일 dropdown (header)
- 5개 snapshot 중 선택 (2026-01-31 ~ 2026-05-20)
- 변경 시 즉시 전체 점수/탭 재계산

### 가중치 슬라이더 (실시간)
- 패밀리 AUM / 기간 수익률 / 기간 샤프 / 운용사 점수 (4 항목)
- 합 100% 강제, 미준수 시 정규화 버튼
- 프리셋: 균등 / AUM 강조 / 수익 강조 / 운용사 강조 / **한투★ 전체 / V1 / V2 / ↻초기화**

### 상품 필터
- **기간**: 1년 / 2년 / 3년 (기본 2Y)
- **샤프 ≥**: 슬라이더 (기본 1.0)
- **패밀리 AUM ≥**: 0~1000억 슬라이더 (기본 400억)
- **라인업**: 전체 / KIS / KIS+KIM (기본 전체)

### Sector 분류 (Strict 4 + 혼합 + 기타 + TDF)
- 국내주식 / 국내채권 / 해외주식 / 해외채권 / 혼합형 / 기타 / TDF (vintage 서브탭)
- 각 sector tab 별 통과 펀드 ranking + 운용사 점수 별도 계산
- 한투 펀드 = **파란색 + 굵게** 강조

### 한투 V1/V2 프리셋
- **V1** (sector 깊이): 3Y / sharp≥1.0 / family≥500억 / 30/10/10/50 → 3 sector 한투 1위
- **V2** (sector 너비): 2Y / sharp≥0.7 / family≥500억 / 30/10/10/50 → 4 sector 한투 진입

## 데이터 소스 (로컬 전용)

snapshot 생성은 Oracle POOLDB 직접 접속 (DB 자격증명은 `.gitignored` build_*.py 에 하드코딩, 본인 PC 에만 존재).

- **KITM** (Zeroin): 1년/2년/3년 SHARP, YIELD, 보수, 클래스
- **INST1** (한투운용): 펀드 master, family AEK
- **결과**: `frontend/public/snapshots/snapshot_YYYYMMDD.json` (각 1.8 MB, 1,645 펀드)

## 종료

두 cmd 창 (PensionEval-API / PensionEval-Frontend) 닫으면 끝.
