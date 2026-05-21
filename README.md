# 퇴직연금 펀드 평가 UI

가중치 슬라이더 + Sector 별 ranking 테이블. FastAPI snapshot + React (Vite + TS) 클라이언트 사이드 재계산.

## 구조

```
web/
├── api/
│   ├── snapshot.py     # xlsx → JSON 변환 (sector 매핑 포함)
│   ├── snapshot.json   # 정적 데이터 (Oracle 안 호출)
│   └── main.py         # FastAPI (snapshot serve + regenerate endpoint)
├── frontend/           # Vite + React + TypeScript
│   ├── package.json
│   └── src/
│       ├── App.tsx                # 메인 (가중치 + sector tabs)
│       ├── components/
│       │   ├── WeightsSlider.tsx  # 가중치 슬라이더 + 프리셋
│       │   └── SectorTable.tsx    # sector 별 ranking 테이블
│       ├── lib/scoring.ts         # 필터 + ranking + 점수
│       └── types.ts
└── run.bat             # launcher
```

## 실행

```cmd
cd web
run.bat
```

자동으로:
- snapshot.json 생성 (없으면)
- FastAPI 실행 (port 8001)
- npm install (처음이면)
- Vite dev 실행 (port 5174)
- 브라우저 자동 열기

## 기능

### 가중치 슬라이더 (실시간)
- AUM / 2년 수익률 / 2년 샤프 / 운용사 sector AUM (4 항목)
- 합 100% 강제, 미준수 시 정규화 버튼
- 프리셋: 균등 / AUM 강조 / 수익 강조 / 운용사 강조

### Sector 분류 (Strict 4 + 혼합 + 기타)
- 국내주식 / 국내채권 / 해외주식 / 해외채권 / 혼합형 / 기타
- 각 sector tab 별로 통과 펀드 ranking

### 사전 필터 (변경 불가, 코드 수정 필요)
- HAEJI_GB = '1' (정상)
- IS_ONLINE = Y (D106 ATTB OR 클래스에 'e/E' 포함)
- IS_PENSION = Y (G115 ATTB)
- SHARP_2Y ≥ 1.0
- YIELD_2Y not null
- AUM > 0
- family AEK ≥ 300억

### 한투 강조
- 한투 펀드 = 파란색 + 굵게
- 요약 카드: 한투 평균 점수 vs 전체 평균, 상위 10 진입 수

## 데이터 갱신

xlsx 가 변경되면:
```cmd
python api\snapshot.py
```
또는 API 호출:
```
POST http://localhost:8001/regenerate
```
브라우저 새로고침 시 새 snapshot 반영.

## 종료

두 cmd 창 (PensionEval-API / PensionEval-Frontend) 닫으면 끝.
