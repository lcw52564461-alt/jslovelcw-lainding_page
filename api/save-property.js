/**
 * Vercel Serverless Function: /api/save-property
 * Chrome 익스텐션에서 전송한 매물 JSON 데이터를 수집하여 Supabase DB에 저장
 */

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  try {
    let bodyObj = req.body;
    if (typeof bodyObj === "string") {
      try {
        bodyObj = JSON.parse(bodyObj);
      } catch (e) {
        bodyObj = {};
      }
    }

    const { property, password } = bodyObj || {};

    if (!property) {
      return res.status(400).json({ error: "매물 데이터(property)가 누락되었습니다." });
    }

    const headerPassword = req.headers["x-admin-password"] || "";
    const inputPassword = (password || headerPassword || "").trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || "love1219**").trim();

    // 비밀번호 검증 (love1219** 기본값 지원)
    if (inputPassword && inputPassword !== adminPassword && inputPassword !== "love1219**") {
      return res.status(401).json({ error: "관리자 비밀번호가 일치하지 않습니다. ('love1219**' 확인 필요)" });
    }

    console.log("[Vercel API] Received Scraped Property:", property.title || property.id);

    // Supabase 환경 변수 유연한 다중 매칭 (Service Role Key 우선 탐색)
    const supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://ukcbvzyyfzwqotvareil.supabase.co"
    ).trim();

    const supabaseKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_7ckpmsNs6bQJKtALe898vw_hu0v2xF1"
    ).trim();

    const supabaseEndpoint = `${supabaseUrl}/rest/v1/properties`;

    // features JSONB 호환 포맷팅 정제
    let featuresArray = [];
    if (Array.isArray(property.features)) {
      featuresArray = property.features.map(f => String(f).trim()).filter(Boolean);
    } else if (typeof property.features === "string" && property.features.trim()) {
      try {
        const parsed = JSON.parse(property.features);
        featuresArray = Array.isArray(parsed) ? parsed : [property.features.trim()];
      } catch (e) {
        featuresArray = [property.features.trim()];
      }
    }

    // Supabase DB 18개 컬럼 안전 매핑
    const payload = {
      id: String(property.id || `prop-${Date.now()}`),
      sourceUrl: String(property.sourceUrl || ""),
      sourceSite: String(property.sourceSite || ""),
      title: String(property.title || "제목 없음"),
      category: String(property.category || "아파트"),
      tradeType: String(property.tradeType || "매매"),
      dongFloor: String(property.dongFloor || "-"),
      price: String(property.price || "-"),
      size: String(property.size || "-"),
      floor: String(property.floor || "-"),
      roomBath: String(property.roomBath || "-"),
      maintenance: String(property.maintenance || "-"),
      prevDeposit: String(property.prevDeposit || "-"),
      direction: String(property.direction || "-"),
      entrance: String(property.entrance || "-"),
      heating: String(property.heating || "-"),
      moveInDate: String(property.moveInDate || "-"),
      parking: String(property.parking || "-"),
      households: String(property.households || "-"),
      buildingUse: String(property.buildingUse || "-"),
      approvalDate: String(property.approvalDate || "-"),
      address: String(property.address || "-"),
      description: String(property.description || "-"),
      features: featuresArray, // JSONB 호환 배열
      image: String(property.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"),
      date: String(property.date || new Date().toISOString().split("T")[0]),
      agentContact: String(property.agentContact || "02-415-8949")
    };

    console.log("[Supabase 호출 시작] Endpoint:", supabaseEndpoint);

    // 4초 타임아웃 방어 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let supabaseRes;
    try {
      supabaseRes = await fetch(supabaseEndpoint, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates, return=minimal"
        },
        body: JSON.stringify([payload]),
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === "AbortError";
      const detailErr = isTimeout 
        ? `[Supabase 4초 타임아웃] DB 서버(Endpoint: ${supabaseUrl})가 응답하지 않습니다.` 
        : `[Supabase Fetch 통신 오류] ${fetchErr.name}: ${fetchErr.message}`;
      console.error(detailErr);
      return res.status(500).json({ error: detailErr });
    }

    clearTimeout(timeoutId);

    if (!supabaseRes.ok) {
      const errorText = await supabaseRes.text();
      console.error("[Supabase Res Error]", supabaseRes.status, errorText);
      return res.status(500).json({ error: `[Supabase HTTP ${supabaseRes.status} 오류 원문]: ${errorText}` });
    }

    return res.status(200).json({
      success: true,
      message: "매물이 Supabase DB에 성공적으로 등록되었습니다!",
      savedProperty: payload
    });
  } catch (error) {
    console.error("[Vercel Handler Catch]", error);
    return res.status(500).json({ error: `[Vercel 서버 내부 예외]: ${error.message || String(error)}` });
  }
}
