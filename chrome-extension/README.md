# 🏠 부동산 매물 크롬 익스텐션 수집기 (Manifest V3)

네이버 부동산 및 부동산뱅크 상세 페이지에서 접속 중인 브라우저의 DOM을 파싱하여, 내 Vercel 홈페이지의 매물 등록 API Endpoint로 데이터를 전송하는 Manifest V3 기준 크롬 익스텐션입니다.

---

## 📁 폴더 구조

```text
랜딩페이지2/
├── chrome-extension/
│   ├── manifest.json       # Manifest V3 익스텐션 매니페스트 파일
│   ├── popup.html          # 익스텐션 팝업 UI (버튼 & 설정 & 미리보기)
│   ├── popup.js            # 팝업 스크립트 (이벤트 처리 및 데이터 통신)
│   ├── content.js          # Content Script (네이버 / 부동산뱅크 DOM 파싱)
│   ├── background.js       # Service Worker (Vercel API POST 전송 처리)
│   └── README.md           # 익스텐션 안내 문서
└── api/
    └── save-property.js    # Vercel 매물 등록 API Endpoint (POST)
```

---

## ⚙️ 크롬 익스텐션 설치 방법 (개발자 모드)

1. **크롬 브라우저**를 실행합니다.
2. 주소창에 `chrome://extensions` 입력 후 엔터를 누릅니다.
3. 우측 상단의 **`개발자 모드 (Developer mode)`** 스위치를 켭니다.
4. 좌측 상단의 **`압축해제된 확장 프로그램을 로드합니다 (Load unpacked)`** 버튼을 클릭합니다.
5. 본 프로젝트의 `chrome-extension` 폴더를 선택합니다.
6. 크롬 툴바에 🏠 아이콘(또는 익스텐션 목록)이 추가됩니다.

---

## 🚀 사용 방법

1. 네이버 부동산 매물 상세 페이지(`land.naver.com` / `m.land.naver.com` / `fin.land.naver.com`) 또는 부동산뱅크 상세 페이지에 접속합니다.
2. 크롬 상단의 익스텐션 아이콘을 클릭하여 팝업 창을 엽니다.
3. `Vercel API Endpoint URL` 입력란에 자신의 Vercel 배포 주소(예: `https://your-domain.vercel.app/api/save-property`)를 입력합니다. (최초 1회 입력 시 자동 저장됩니다)
4. **`🚀 홈페이지로 전송`** 버튼을 클릭합니다.
5. Content Script가 DOM을 분석하여 가격, 면적, 층수, 특징 등의 정보를 추출한 후 Vercel 서버로 전송합니다.

---

## 📊 추출 JSON 데이터 예시

```json
{
  "id": "naver-2637595719",
  "sourceUrl": "https://m.land.naver.com/article/info/2637595719",
  "sourceSite": "네이버부동산",
  "title": "잠실 리센츠 33평형 남향 로얄동",
  "category": "리센츠",
  "tradeType": "매매",
  "dongFloor": "205동 18층",
  "price": "25억 5,000만",
  "size": "공급 109.99㎡ / 전용 84.99㎡",
  "floor": "18 / 28층",
  "roomBath": "방 3개 / 욕실 2개",
  "maintenance": "약 25만원 (사용량 별도)",
  "prevDeposit": "-",
  "direction": "남향 (거실 기준)",
  "moveInDate": "즉시입주 (협의가능)",
  "description": "올확장 및 깔끔한 인테리어가 완비되어 즉시 입주 가능하며...",
  "features": ["네이버검증", "남향", "올수리", "역세권", "즉시입주"],
  "date": "2026-07-19"
}
```
