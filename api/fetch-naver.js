export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  const articleNo = req.query.articleNo || (req.body && req.body.articleNo);

  if (!articleNo) {
    return res.status(400).json({ error: "네이버 매물번호를 입력해 주세요." });
  }

  const cleanNo = String(articleNo).replace(/[^0-9]/g, "");

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Referer": `https://fin.land.naver.com/articles/${cleanNo}`,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
    };

    let rawData = null;

    // 네이버 fin.land front-api 호출
    try {
      const apiRes = await fetch(`https://fin.land.naver.com/front-api/v1/articles/${cleanNo}`, { headers });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json && json.result) {
          rawData = json.result;
        }
      }
    } catch (e1) {}

    // 네이버 m.land API fallback
    if (!rawData) {
      try {
        const mRes = await fetch(`https://m.land.naver.com/article/info/${cleanNo}`, { headers });
        if (mRes.ok) {
          const html = await mRes.text();
          const match = html.match(/var\s+articleInfo\s*=\s*({[\s\S]*?});/);
          if (match) {
            rawData = JSON.parse(match[1]);
          }
        }
      } catch (e2) {}
    }

    if (!rawData) {
      return res.status(404).json({ 
        error: `네이버 매물번호 (${cleanNo}) 정보를 불러올 수 없습니다. 네이버 부동산에 등록 노출 중인 매물번호인지 확인해 주세요.` 
      });
    }

    // ----------------------------------------------------
    // 네이버 데이터 ➔ 내 홈페이지 데이터 양식 정밀 파서 (Parser)
    // ----------------------------------------------------

    // 1. 거래 유형 (매매, 전세, 월세)
    let tradeType = "매매";
    const rawTrade = rawData.tradeTypeName || rawData.tradTpNm || rawData.tradeType || "";
    if (rawTrade.includes("전세") || rawTrade === "B1") tradeType = "전세";
    else if (rawTrade.includes("월세") || rawTrade === "B2" || rawTrade === "B3") tradeType = "월세";

    // 2. 카테고리 (아파트, 상가, 오피스텔 등)
    let category = "아파트";
    const rawCat = rawData.realEstateTypeName || rawData.rletTpNm || rawData.articleTypeName || "";
    if (rawCat.includes("상가") || rawCat.includes("사무실")) category = "상가/사무실";
    else if (rawCat.includes("오피스텔")) category = "오피스텔";
    else if (rawCat.includes("재건축") || rawCat.includes("재개발")) category = "재건축/재개발";
    else if (rawData.articleName && rawData.articleName.includes("리센츠")) category = "리센츠";
    else if (rawData.articleName && rawData.articleName.includes("엘스")) category = "엘스";
    else if (rawData.articleName && rawData.articleName.includes("트리지움")) category = "트리지움";

    // 3. 가격 포맷 변환 (네이버 숫자를 '24억 8,000만원' 형식으로 변환)
    let priceStr = "";
    if (rawData.priceInfo) {
      priceStr = rawData.priceInfo.priceTitle || rawData.priceInfo.price || "";
    } else if (rawData.dealOrWarrantPrc) {
      priceStr = rawData.dealOrWarrantPrc;
    } else if (rawData.prc) {
      priceStr = formatKoreanPrice(rawData.prc, rawData.rentPrc);
    }
    if (!priceStr) priceStr = "가격 문의";

    // 4. 면적 포맷 (공급 / 전용)
    let sizeStr = "";
    if (rawData.spaceInfo) {
      sizeStr = `공급 ${rawData.spaceInfo.supplySpace || ''}㎡ / 전용 ${rawData.spaceInfo.exclusiveSpace || ''}㎡`;
    } else if (rawData.spc1 || rawData.spc2) {
      sizeStr = `공급 ${rawData.spc1 || ''}㎡ / 전용 ${rawData.spc2 || ''}㎡`;
    }

    // 5. 층수 포맷
    let floorStr = "";
    if (rawData.floorInfo) {
      floorStr = `${rawData.floorInfo.targetFloor || ''} / ${rawData.floorInfo.totalFloor || ''}층`;
    } else if (rawData.flrInfo) {
      floorStr = `${rawData.flrInfo}층`;
    }

    // 6. 매물 제목 생성
    const aptName = rawData.articleName || rawData.atclNm || rawData.buildingName || "잠실 아파트";
    const featureHead = rawData.headline || rawData.articleFeatureDesc || rawData.atclFtrDesc || "인테리어 최상";
    const title = `${aptName} (${featureHead.slice(0, 30)})`.trim();

    // 7. 상세 설명
    const description = (rawData.detailDescription || rawData.articleFeatureDesc || rawData.atclFtrDesc || "네이버 부동산 검증 완료 매물입니다.").trim();

    // 8. 이미지
    let imageUrl = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80";
    if (rawData.photoList && rawData.photoList.length > 0) {
      imageUrl = rawData.photoList[0].fullPath || rawData.photoList[0].imagePath || imageUrl;
    } else if (rawData.repImgUrl) {
      imageUrl = rawData.repImgUrl;
    }

    // 9. 특징 태그
    let features = ["네이버검증", "실매물"];
    if (rawData.tagList && Array.isArray(rawData.tagList)) {
      features = rawData.tagList;
    } else if (featureHead) {
      features = featureHead.split(/[\s,]+/).filter(s => s.length > 1).slice(0, 5);
    }

    const parsedProperty = {
      id: "naver-" + cleanNo,
      title: title,
      category: category,
      tradeType: tradeType,
      price: priceStr,
      size: sizeStr,
      floor: floorStr,
      address: rawData.address || "서울특별시 송파구 잠실동",
      description: description,
      features: features,
      image: imageUrl,
      date: new Date().toISOString().split("T")[0],
      agentContact: "02-415-8949"
    };

    return res.status(200).json({ success: true, property: parsedProperty });

  } catch (err) {
    return res.status(500).json({ error: "네이버 매물 파싱 중 오류가 발생했습니다: " + err.message });
  }
}

// 만원 숫자를 한국어 가격(억/만원)으로 변환해주는 헬퍼 함수
function formatKoreanPrice(prc, rentPrc) {
  let num = parseInt(String(prc).replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return String(prc);

  let result = "";
  if (num >= 10000) {
    const uk = Math.floor(num / 10000);
    const rest = num % 10000;
    result = rest > 0 ? `${uk}억 ${rest.toLocaleString()}만` : `${uk}억`;
  } else {
    result = `${num.toLocaleString()}만`;
  }

  if (rentPrc) {
    let rentNum = parseInt(String(rentPrc).replace(/[^0-9]/g, ""), 10);
    if (!isNaN(rentNum)) {
      result += ` / ${rentNum.toLocaleString()}만`;
    }
  }

  return result;
}
