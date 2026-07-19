/**
 * Chrome Extension Content Script
 * 네이버 부동산 및 부동산뱅크 상세/완료 페이지 DOM 데이터 파싱
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_PROPERTY") {
    try {
      const data = extractPropertyData();
      sendResponse({ success: true, data: data });
    } catch (error) {
      console.error("[Scraper Error]", error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // 비동기 응답 지원
});

function extractPropertyData() {
  const url = window.location.href;
  let property = null;

  if (url.includes("naver.com")) {
    property = scrapeNaverLand(url);
  } else if (url.includes("neonet.co.kr") || url.includes("landbank.co.kr") || url.includes("rbank") || url.includes("land.naver.com")) {
    property = scrapeRbank(url);
  } else {
    property = scrapeGeneric(url);
  }

  return property;
}

/**
 * 네이버 부동산 DOM 파싱 (PC/모바일 공통 지원)
 */
function scrapeNaverLand(url) {
  const fullText = document.body.innerText || "";
  const kvMap = extractKeyValuePairs();
  
  // 매물 번호 추출
  const articleNoMatch = url.match(/(?:articleNo|atclNo|articles)\/([0-9]+)/i) || url.match(/([0-9]{9,11})/);
  const articleNo = articleNoMatch ? articleNoMatch[1] : Date.now().toString();

  // 제목 추출
  let title = document.querySelector(".info_title, .title, h3.title, .article_header .name, .item_title")?.innerText?.trim() || "";
  if (!title) {
    const mainHead = document.querySelector("h1, h2, h3");
    title = mainHead ? mainHead.innerText.trim() : document.title;
  }

  // 거래종류 & 가격
  let tradeType = kvMap["거래종류"] || kvMap["거래방식"] || "매매";
  let price = "";

  const priceElem = document.querySelector(".price_area, .price, .info_price, .article_price, .item_price");
  if (priceElem) {
    const rawPrice = priceElem.innerText.trim();
    if (rawPrice.includes("전세")) tradeType = "전세";
    else if (rawPrice.includes("월세")) tradeType = "월세";
    else if (rawPrice.includes("매매")) tradeType = "매매";
    price = rawPrice.replace(/(매매|전세|월세)/g, "").trim();
  }

  if (!price) price = kvMap["가격"] || kvMap["매매가"] || kvMap["보증금"] || kvMap["월세"] || "-";

  // 면적
  let size = kvMap["공급/전용면적"] || kvMap["면적"] || kvMap["전용면적"] || kvMap["공급면적"] || "-";

  // 층수 & 동층
  let floor = kvMap["해당층/총층"] || kvMap["층수"] || kvMap["층"] || "-";
  let dongFloor = kvMap["동/층"] || kvMap["동"] || floor || "-";

  // 방향
  let direction = kvMap["방향"] || kvMap["거실방향"] || "-";
  if (direction === "-" ) {
    const dirMatch = fullText.match(/(남향|동향|서향|북향|남동향|남서향)/);
    if (dirMatch) direction = dirMatch[0];
  }

  // 관리비
  let maintenance = kvMap["관리비"] || kvMap["월관리비"] || "-";

  // 입주가능일
  let moveInDate = kvMap["입주가능일"] || kvMap["입주일"] || "-";

  // 상세 설명
  let description = document.querySelector(".article_description, .detail_info, .info_detail, .article_detail, .memo_text")?.innerText?.trim() || "";
  if (!description) description = kvMap["매물특징"] || kvMap["상세설명"] || title;

  // 단지 카테고리 판별 (더미 기본값 제거)
  let category = parseCategoryFromText(title + " " + fullText + " " + (kvMap["단지명"] || ""));

  // 특징 태그
  let features = [];
  document.querySelectorAll(".tag, .tag_item, .info_tag, .spec_item, .badge").forEach(tag => {
    const txt = tag.innerText.trim();
    if (txt && txt.length < 15 && !features.includes(txt)) {
      features.push(txt);
    }
  });

  return {
    id: `naver-${articleNo}`,
    sourceUrl: url,
    sourceSite: "네이버부동산",
    articleNo: articleNo,
    title: title || `네이버 매물 ${articleNo}`,
    category: category,
    tradeType: tradeType,
    dongFloor: dongFloor,
    price: price,
    size: size,
    floor: floor,
    roomBath: kvMap["방수/욕실수"] || kvMap["방/욕실"] || kvMap["방수"] || "-",
    maintenance: maintenance,
    prevDeposit: kvMap["기보증금/월세"] || kvMap["기보증금"] || "-",
    direction: direction,
    entrance: kvMap["현관구조"] || "-",
    heating: kvMap["난방방식"] || kvMap["난방"] || "-",
    moveInDate: moveInDate,
    parking: kvMap["주차대수"] || kvMap["총주차대수"] || "-",
    households: kvMap["총세대수"] || kvMap["세대수"] || "-",
    buildingUse: kvMap["건축물용도"] || kvMap["용도"] || "-",
    approvalDate: kvMap["사용승인일"] || kvMap["준공인가일"] || "-",
    address: kvMap["소재지"] || kvMap["주소"] || "-",
    description: description,
    features: features.length > 0 ? features : [tradeType, category].filter(f => f && f !== "-"),
    image: getPageImage(),
    date: new Date().toISOString().split("T")[0],
    agentContact: "02-415-8949"
  };
}

/**
 * 부동산뱅크 DOM 파싱 (등록완료 & 상세페이지 완벽 수집)
 */
function scrapeRbank(url) {
  const fullText = document.body.innerText || "";
  const kvMap = extractKeyValuePairs();

  // 매물 번호 / ID
  const rbankIdMatch = url.match(/([0-9]{6,12})/);
  const rbankId = rbankIdMatch ? rbankIdMatch[1] : Date.now().toString();

  // 거래종류 & 단지 카테고리
  let tradeType = kvMap["거래종류"] || kvMap["거래구분"] || "매매";
  if (fullText.includes("전세가") || fullText.includes("전세")) tradeType = "전세";
  else if (fullText.includes("월세")) tradeType = "월세";
  else if (fullText.includes("매매가") || fullText.includes("매매")) tradeType = "매매";

  let category = parseCategoryFromText(fullText + " " + (kvMap["단지명"] || kvMap["아파트명"] || ""));

  // 1. title (매물특징) 핀포인트 파싱 ("가성비매물 찾으신분 강추물건 I 역세권..." 수집)
  let featureTitle = kvMap["매물특징"] || kvMap["상세특징"] || kvMap["특징"] || kvMap["매물설명"] || "";
  
  if (!featureTitle) {
    // 폼/테이블 내 '매물특징' 라벨이 붙은 input/textarea/td 탐색
    document.querySelectorAll("tr, dl, div, li, td").forEach(el => {
      const txt = el.innerText || "";
      if (txt.includes("매물특징") || txt.includes("특징")) {
        const inputElem = el.querySelector("input, textarea");
        if (inputElem && inputElem.value && inputElem.value.trim().length > 3) {
          featureTitle = inputElem.value.trim();
        } else {
          const val = txt.replace(/매물특징|특징|:/g, "").trim();
          if (val && val.length > 3 && !val.includes("부동산뱅크") && !val.includes("중개업소")) {
            featureTitle = val;
          }
        }
      }
    });
  }

  // 폼 input 중 name에 feature, title, memo가 들어간 값 직접 탐색
  if (!featureTitle) {
    document.querySelectorAll("input[name*='feature'], input[name*='title'], textarea[name*='feature'], textarea[name*='memo']").forEach(elem => {
      if (elem.value && elem.value.trim().length > 3 && !elem.value.includes("부동산뱅크")) {
        featureTitle = elem.value.trim();
      }
    });
  }

  let rawTitle = document.querySelector(".detail_title, .title, .subject, .article_title, h1, h2, h3")?.innerText?.trim() || "";
  let title = featureTitle;
  
  // "부동산뱅크 중개업소 관리자" 및 페이지 헤더 탭 타이틀 완전 차단
  if (!title || title.includes("부동산뱅크") || title.includes("중개업소") || title.includes("관리자") || title.includes("등록")) {
    if (rawTitle && !rawTitle.includes("부동산뱅크") && !rawTitle.includes("중개업소") && !rawTitle.includes("관리자")) {
      title = rawTitle;
    } else {
      const sizeStr = kvMap["면적"] || kvMap["공급/전용"] || "";
      title = `${category} ${tradeType} ${sizeStr}`.trim();
    }
  }

  // 2. price (금액) 핀포인트 파싱 ("전세가 145,000만원" 수집)
  let price = kvMap["전세가"] || kvMap["매매가"] || kvMap["보증금"] || kvMap["전세"] || kvMap["월세"] || kvMap["가격"] || kvMap["거래가"] || kvMap["거래금액"] || "";

  // input element 파싱 (name에 price, money, jeonse가 들은 폼 입력값)
  if (!price || price === "-") {
    document.querySelectorAll("input[name*='price'], input[name*='money'], input[name*='pay'], input[name*='deposit']").forEach(elem => {
      if (elem.value && elem.value.trim()) {
        const val = elem.value.trim();
        if (/^[0-9,]+$/.test(val)) {
          price = `${val}만원`;
        } else if (val.length > 1) {
          price = val;
        }
      }
    });
  }

  // 전세가 / 매매가 라벨 바로 뒤 input / td 파싱
  if (!price || price === "-") {
    document.querySelectorAll("tr, dl, div, td").forEach(el => {
      const txt = el.innerText || "";
      if (txt.includes("전세가") || txt.includes("매매가") || txt.includes("보증금") || txt.includes("가격")) {
        const input = el.querySelector("input");
        if (input && input.value && input.value.trim()) {
          const v = input.value.trim();
          price = /^[0-9,]+$/.test(v) ? `${v}만원` : v;
        }
      }
    });
  }

  if (!price || price === "-") {
    const priceNodes = document.querySelectorAll(".price, .price_area, .pay_info, .total_price, td, div");
    for (const node of priceNodes) {
      const txt = node.innerText ? node.innerText.trim() : "";
      if ((txt.includes("만원") || txt.includes("억")) && txt.length < 30 && !txt.includes("관리비") && !txt.includes("합계")) {
        price = txt.replace(/(매매|전세|월세|가격|보증금|가|전세가|매매가|:)/g, "").trim();
        if (price) break;
      }
    }
  }

  if (!price || price === "-") {
    const priceMatch = fullText.match(/(?:전세가|매매가|전세|월세|보증금|가격|거래가)\s*[:\s]?\s*([0-9억천만,\/\s]+만?원?)/i) || fullText.match(/([0-9,]+\s*만원)/);
    if (priceMatch) price = priceMatch[1].trim();
  }

  if (!price) price = "-";

  // 3. maintenance (세부관리비) 핀포인트 파싱 ("350,000원" 수집)
  let maintenance = kvMap["관리비합계"] || kvMap["총관리비"] || kvMap["세부관리비"] || kvMap["관리비"] || "";

  // input 폼 element 직접 수집 (name에 maint, manage가 들은 입력필드)
  document.querySelectorAll("input[name*='maint'], input[name*='manage'], input[name*='total_maint']").forEach(elem => {
    if (elem.value && elem.value.trim()) {
      const val = elem.value.trim();
      if (/^[0-9,]+$/.test(val)) {
        maintenance = `${val}원`;
      } else if (val.length > 1) {
        maintenance = val;
      }
    }
  });

  // -원 이거나 빈 값인 경우 세부관리비 초록색 박스 & 라벨 핀포인트 파싱
  if (!maintenance || maintenance === "-원" || maintenance === "-" || maintenance === "0원") {
    document.querySelectorAll(".total_price, .pay_total, .box_green, .green_box, tr, dl, div, p, span, td").forEach(el => {
      const txt = el.innerText ? el.innerText.trim() : "";
      if (txt.includes("관리비") || txt.includes("합계") || txt.includes("세부관리비")) {
        const input = el.querySelector("input");
        if (input && input.value && input.value.trim() && input.value.trim() !== "0") {
          const v = input.value.trim();
          maintenance = /^[0-9,]+$/.test(v) ? `${v}원` : v;
        } else {
          const match = txt.match(/(?:관리비\s*합계|총\s*관리비|세부\s*관리비|합계)\s*[:\s]?\s*([0-9,]+만?원?)/i) || txt.match(/([0-9,]{4,}\s*원)/);
          if (match && match[1] && (!maintenance || maintenance === "-원" || maintenance === "-")) {
            maintenance = match[1].trim();
          }
        }
      }
    });
  }

  if (!maintenance || maintenance === "-원" || maintenance === "-") {
    const mainMatch = fullText.match(/(?:관리비\s*합계|총\s*관리비|세부\s*관리비)\s*[:\s]?\s*([0-9,]+만?원?)/i);
    if (mainMatch) maintenance = mainMatch[1].trim();
  }

  if (!maintenance || maintenance === "-원") maintenance = "-";

  // 동/층 & 층수
  let dongFloor = kvMap["동/층"] || kvMap["동"] || kvMap["해당동/층"] || "-";
  let floor = kvMap["층수"] || kvMap["해당층/총층"] || kvMap["층"] || "-";
  if (dongFloor === "-" && floor !== "-") dongFloor = floor;

  // 상세 설명
  let description = document.querySelector(".detail_info, .memo, .description, .cont_box, #memo")?.innerText?.trim() || "";
  if (!description) description = kvMap["상세설명"] || featureTitle || title;

  return {
    id: `rbank-${rbankId}`,
    sourceUrl: url,
    sourceSite: "부동산뱅크",
    title: title,
    category: category,
    tradeType: tradeType,
    dongFloor: dongFloor,
    price: price,
    size: kvMap["면적"] || kvMap["공급/전용"] || kvMap["전용면적"] || kvMap["공급면적"] || "-",
    floor: floor,
    roomBath: kvMap["방수/욕실수"] || kvMap["방수"] || kvMap["방/욕실"] || "-",
    maintenance: maintenance,
    prevDeposit: kvMap["기보증금"] || kvMap["보증금"] || "-",
    direction: kvMap["향"] || kvMap["방향"] || kvMap["거실방향"] || "-",
    entrance: kvMap["현관구조"] || kvMap["구조"] || "-",
    heating: kvMap["난방방식"] || kvMap["난방연료"] || "-",
    moveInDate: kvMap["입주일"] || kvMap["입주가능일"] || "-",
    parking: kvMap["주차대수"] || kvMap["총주차대수"] || "-",
    households: kvMap["총세대수"] || kvMap["세대수"] || "-",
    buildingUse: kvMap["건축물용도"] || kvMap["용도"] || "-",
    approvalDate: kvMap["사용승인일"] || kvMap["준공년월"] || "-",
    address: kvMap["소재지"] || kvMap["주소"] || kvMap["위치"] || "-",
    description: description,
    features: [tradeType, category, "부동산뱅크수집"].filter(f => f && f !== "-"),
    image: getPageImage(),
    date: new Date().toISOString().split("T")[0],
    agentContact: "02-415-8949"
  };
}

/**
 * 범용 웹 스크래핑 파서
 */
function scrapeGeneric(url) {
  const kvMap = extractKeyValuePairs();
  const fullText = document.body.innerText || "";
  const category = parseCategoryFromText(document.title + " " + fullText);

  return {
    id: `gen-${Date.now()}`,
    sourceUrl: url,
    sourceSite: "일반 웹페이지",
    title: document.title || "부동산 매물",
    category: category,
    tradeType: kvMap["거래종류"] || "매매",
    dongFloor: kvMap["동/층"] || kvMap["층수"] || "-",
    price: kvMap["가격"] || kvMap["매매가"] || "-",
    size: kvMap["면적"] || kvMap["공급/전용면적"] || "-",
    floor: kvMap["층수"] || "-",
    roomBath: kvMap["방수/욕실수"] || "-",
    maintenance: kvMap["관리비"] || "-",
    prevDeposit: "-",
    direction: kvMap["방향"] || "-",
    entrance: kvMap["현관구조"] || "-",
    heating: kvMap["난방방식"] || "-",
    moveInDate: kvMap["입주가능일"] || "-",
    parking: kvMap["주차대수"] || "-",
    households: kvMap["총세대수"] || "-",
    buildingUse: kvMap["건축물용도"] || "-",
    approvalDate: kvMap["사용승인일"] || "-",
    address: kvMap["소재지"] || kvMap["주소"] || "-",
    description: fullText.slice(0, 300),
    features: ["웹수집매물"],
    image: getPageImage(),
    date: new Date().toISOString().split("T")[0],
    agentContact: "02-415-8949"
  };
}

/**
 * 텍스트에서 단지 카테고리 판단 (하드코딩 제거)
 */
function parseCategoryFromText(text) {
  if (!text) return "아파트";
  if (text.includes("리센츠")) return "리센츠";
  if (text.includes("엘스")) return "엘스";
  if (text.includes("트리지움")) return "트리지움";
  if (text.includes("레이크팰리스")) return "레이크팰리스";
  if (text.includes("파크리오")) return "파크리오";
  if (text.includes("상가") || text.includes("사무실")) return "상가/사무실";
  if (text.includes("오피스텔")) return "오피스텔";
  return "아파트";
}

/**
 * 페이지 내 대표 이미지 추출
 */
function getPageImage() {
  const img = document.querySelector(".photo_area img, .detail_img img, .gallery img, #main_img, meta[property='og:image']");
  if (img) {
    const src = img.getAttribute("content") || img.getAttribute("src");
    if (src && src.startsWith("http")) return src;
  }
  return "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80";
}

/**
 * HTML 내 <th>/<td>, <dt>/<dd>, <input> 라벨에서 Key-Value 쌍 맵 생성 (input value 지원)
 */
function extractKeyValuePairs() {
  const map = {};

  // 1. input / select / textarea 폼 데이터 파싱
  document.querySelectorAll("input, select, textarea").forEach(elem => {
    const name = elem.getAttribute("name") || elem.getAttribute("id") || "";
    const val = elem.value ? elem.value.trim() : "";
    if (name && val) {
      map[name] = val;
    }
  });

  // 2. th / td (td 내부에 input/select/textarea가 들어있을 때 폼 value 우선 수집)
  document.querySelectorAll("tr").forEach(row => {
    const ths = row.querySelectorAll("th");
    const tds = row.querySelectorAll("td");
    if (ths.length > 0 && tds.length > 0) {
      for (let i = 0; i < Math.min(ths.length, tds.length); i++) {
        const k = ths[i].innerText.replace(/\s+/g, "").trim();
        let v = "";
        const inputElem = tds[i].querySelector("input, select, textarea");
        if (inputElem && inputElem.value) {
          v = inputElem.value.trim();
        } else {
          v = tds[i].innerText.replace(/\s+/g, " ").trim();
        }
        if (k && v) map[k] = v;
      }
    }
  });

  // 3. dt / dd (dd 내부에 input이 있을 경우 지원)
  document.querySelectorAll("dl").forEach(dl => {
    const dts = dl.querySelectorAll("dt");
    const dds = dl.querySelectorAll("dd");
    if (dts.length > 0 && dds.length > 0) {
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        const k = dts[i].innerText.replace(/\s+/g, "").trim();
        let v = "";
        const inputElem = dds[i].querySelector("input, select, textarea");
        if (inputElem && inputElem.value) {
          v = inputElem.value.trim();
        } else {
          v = dds[i].innerText.replace(/\s+/g, " ").trim();
        }
        if (k && v) map[k] = v;
      }
    }
  });

  // 4. 커스텀 리스트
  document.querySelectorAll(".info_table_item, .item_info_detail, li").forEach(item => {
    const label = item.querySelector(".table_th, .label, .title, span:first-child");
    const value = item.querySelector(".table_td, .val, .value, span:last-child");
    if (label && value && label !== value) {
      const k = label.innerText.replace(/\s+/g, "").trim();
      let v = "";
      const inputElem = value.querySelector("input, select, textarea");
      if (inputElem && inputElem.value) {
        v = inputElem.value.trim();
      } else {
        v = value.innerText.replace(/\s+/g, " ").trim();
      }
      if (k && v) map[k] = v;
    }
  });

  return map;
}
