/**
 * Chrome Extension Content Script
 * 네이버 부동산 및 부동산뱅크 상세 페이지 DOM 데이터 파싱
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
  } else if (url.includes("neonet.co.kr") || url.includes("landbank.co.kr")) {
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
  
  // 매물 번호 추출
  const articleNoMatch = url.match(/(?:articleNo|atclNo|articles)\/([0-9]+)/i) || url.match(/([0-9]{9,11})/);
  const articleNo = articleNoMatch ? articleNoMatch[1] : Date.now().toString();

  // 제목 추출
  let title = document.querySelector(".info_title, .title, h3.title, .article_header .name")?.innerText?.trim() || "";
  if (!title) {
    const mainHead = document.querySelector("h1, h2, h3");
    title = mainHead ? mainHead.innerText.trim() : document.title;
  }

  // 테이블 Key-Value 수집
  const kvMap = extractKeyValuePairs();

  // 거래종류 & 가격
  let tradeType = "매매";
  let price = "";

  const priceElem = document.querySelector(".price_area, .price, .info_price, .article_price");
  if (priceElem) {
    const rawPrice = priceElem.innerText.trim();
    if (rawPrice.includes("전세")) tradeType = "전세";
    else if (rawPrice.includes("월세")) tradeType = "월세";
    price = rawPrice.replace(/(매매|전세|월세)/g, "").trim();
  }

  if (!price && kvMap["거래방식"]) price = kvMap["거래방식"];
  if (!price && kvMap["가격"]) price = kvMap["가격"];

  // 면적
  let size = kvMap["공급/전용면적"] || kvMap["면적"] || kvMap["전용면적"] || "";
  if (!size) {
    const sizeElem = document.querySelector(".info_area, .area");
    if (sizeElem) size = sizeElem.innerText.trim();
  }

  // 층수 & 동층
  let floor = kvMap["해당층/총층"] || kvMap["층수"] || kvMap["층"] || "";
  let dongFloor = kvMap["동/층"] || floor || "";

  // 방향
  let direction = kvMap["방향"] || kvMap["거실방향"] || "";
  if (!direction) {
    const dirMatch = fullText.match(/(남향|동향|서향|북향|남동향|남서향)/);
    if (dirMatch) direction = dirMatch[0];
  }

  // 관리비
  let maintenance = kvMap["관리비"] || "약 25만원 (사용량 별도)";

  // 입주가능일
  let moveInDate = kvMap["입주가능일"] || kvMap["입주일"] || "즉시입주 (협의가능)";

  // 매물 특징 & 상세 설명
  let features = [];
  const featureTags = document.querySelectorAll(".tag, .tag_item, .info_tag, .spec_item");
  featureTags.forEach(tag => {
    const txt = tag.innerText.trim();
    if (txt && txt.length < 15 && !features.includes(txt)) {
      features.push(txt);
    }
  });

  let description = document.querySelector(".article_description, .detail_info, .info_detail, .article_detail")?.innerText?.trim() || "";
  if (!description) description = title + " - 네이버 부동산 추천 매물입니다.";

  // 단지 카테고리 판별
  let category = "리센츠";
  if (fullText.includes("엘스")) category = "엘스";
  else if (fullText.includes("트리지움")) category = "트리지움";
  else if (fullText.includes("상가") || fullText.includes("사무실")) category = "상가/사무실";
  else if (fullText.includes("오피스텔")) category = "오피스텔";

  return {
    id: `naver-${articleNo}`,
    sourceUrl: url,
    sourceSite: "네이버부동산",
    articleNo: articleNo,
    title: title || `네이버 매물 ${articleNo}`,
    category: category,
    tradeType: tradeType,
    dongFloor: dongFloor || "상세문의",
    price: price || "가격협의",
    size: size || "공급 109.99㎡ / 전용 84.99㎡",
    floor: floor || "중층",
    roomBath: kvMap["방수/욕실수"] || kvMap["방/욕실"] || "방 3개 / 욕실 2개",
    maintenance: maintenance,
    prevDeposit: kvMap["기보증금/월세"] || "-",
    direction: direction || "남향 (거실 기준)",
    entrance: kvMap["현관구조"] || "계단식",
    heating: kvMap["난방방식"] || "지역난방 / 열병합",
    moveInDate: moveInDate,
    parking: kvMap["주차대수"] || "세대당 1.3대",
    households: kvMap["총세대수"] || "1,200세대",
    buildingUse: kvMap["건축물용도"] || "공동주택 (아파트)",
    approvalDate: kvMap["사용승인일"] || "2008년 7월",
    address: kvMap["소재지"] || kvMap["주소"] || "서울특별시 송파구 잠실동",
    description: description,
    features: features.length > 0 ? features : ["네이버검증", tradeType, category, direction || "남향"],
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
    date: new Date().toISOString().split("T")[0],
    agentContact: "02-415-8949"
  };
}

/**
 * 부동산뱅크 DOM 파싱
 */
function scrapeRbank(url) {
  const fullText = document.body.innerText || "";
  const kvMap = extractKeyValuePairs();

  let title = document.querySelector(".detail_title, .title, h2, h3")?.innerText?.trim() || "";
  if (!title) title = document.title;

  let tradeType = "매매";
  if (fullText.includes("전세")) tradeType = "전세";
  else if (fullText.includes("월세")) tradeType = "월세";

  let category = "리센츠";
  if (fullText.includes("엘스")) category = "엘스";
  else if (fullText.includes("트리지움")) category = "트리지움";

  return {
    id: `rbank-${Date.now()}`,
    sourceUrl: url,
    sourceSite: "부동산뱅크",
    title: title,
    category: category,
    tradeType: tradeType,
    dongFloor: kvMap["동/층"] || kvMap["층수"] || "로얄층",
    price: kvMap["매매가"] || kvMap["보증금"] || kvMap["가격"] || "가격협의",
    size: kvMap["면적"] || kvMap["공급/전용"] || "공급 109.99㎡ / 전용 84.99㎡",
    floor: kvMap["층수"] || kvMap["해당층"] || "중층",
    roomBath: kvMap["방수"] || "방 3개 / 욕실 2개",
    maintenance: kvMap["관리비"] || "약 25만원",
    prevDeposit: "-",
    direction: kvMap["향"] || kvMap["방향"] || "남향",
    entrance: "계단식",
    heating: "지역난방 / 열병합",
    moveInDate: kvMap["입주일"] || "즉시입주",
    parking: "세대당 1.3대",
    households: "1,200세대",
    buildingUse: "공동주택",
    approvalDate: "2008년 7월",
    address: kvMap["소재지"] || "서울특별시 송파구 잠실동",
    description: kvMap["매물특징"] || kvMap["상세설명"] || title,
    features: ["부동산뱅크실매물", tradeType, category],
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
    date: new Date().toISOString().split("T")[0],
    agentContact: "02-415-8949"
  };
}

/**
 * 범용 웹 스크래핑 파서
 */
function scrapeGeneric(url) {
  const kvMap = extractKeyValuePairs();
  return {
    id: `gen-${Date.now()}`,
    sourceUrl: url,
    sourceSite: "일반 웹페이지",
    title: document.title,
    category: "리센츠",
    tradeType: "매매",
    dongFloor: kvMap["층수"] || "상세문의",
    price: kvMap["가격"] || kvMap["매매가"] || "가격협의",
    size: kvMap["면적"] || "공급 109.99㎡",
    floor: "중층",
    roomBath: "방 3개 / 욕실 2개",
    maintenance: "약 25만원",
    prevDeposit: "-",
    direction: "남향",
    entrance: "계단식",
    heating: "지역난방 / 열병합",
    moveInDate: "즉시입주",
    parking: "세대당 1.3대",
    households: "1,200세대",
    buildingUse: "공동주택",
    approvalDate: "2008년 7월",
    address: "서울특별시 송파구 잠실동",
    description: document.body.innerText.slice(0, 300),
    features: ["웹수집매물"],
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
    date: new Date().toISOString().split("T")[0],
    agentContact: "02-415-8949"
  };
}

/**
 * HTML 내 <th>/<td>, <dt>/<dd>, 리스트 항목에서 Key-Value 쌍 맵 생성
 */
function extractKeyValuePairs() {
  const map = {};

  // 1. th / td
  document.querySelectorAll("tr").forEach(row => {
    const ths = row.querySelectorAll("th");
    const tds = row.querySelectorAll("td");
    if (ths.length > 0 && tds.length > 0) {
      for (let i = 0; i < Math.min(ths.length, tds.length); i++) {
        const k = ths[i].innerText.replace(/\s+/g, "").trim();
        const v = tds[i].innerText.replace(/\s+/g, " ").trim();
        if (k && v) map[k] = v;
      }
    }
  });

  // 2. dt / dd
  document.querySelectorAll("dl").forEach(dl => {
    const dts = dl.querySelectorAll("dt");
    const dds = dl.querySelectorAll("dd");
    if (dts.length > 0 && dds.length > 0) {
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        const k = dts[i].innerText.replace(/\s+/g, "").trim();
        const v = dds[i].innerText.replace(/\s+/g, " ").trim();
        if (k && v) map[k] = v;
      }
    }
  });

  // 3. custom item class list (.info_table_item, .detail_list 등)
  document.querySelectorAll(".info_table_item, .item_info_detail, li").forEach(item => {
    const label = item.querySelector(".table_th, .label, .title, span:first-child");
    const value = item.querySelector(".table_td, .val, .value, span:last-child");
    if (label && value && label !== value) {
      const k = label.innerText.replace(/\s+/g, "").trim();
      const v = value.innerText.replace(/\s+/g, " ").trim();
      if (k && v) map[k] = v;
    }
  });

  return map;
}
