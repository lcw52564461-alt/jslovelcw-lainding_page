/**
 * Vercel Serverless Function: /api/save-property
 * Chrome 익스텐션에서 전송한 매물 JSON 데이터를 수집하여 Supabase DB에 저장
 */

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  try {
    const { property, password } = req.body || {};

    if (!property) {
      return res.status(400).json({ error: "매물 데이터(property)가 누락되었습니다." });
    }

    const headerPassword = req.headers["x-admin-password"] || "";
    const inputPassword = (password || headerPassword || "").trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || "love1219**").trim();

    // 비밀번호 검증 (love1219** 기본값도 함께 지원)
    if (inputPassword && inputPassword !== adminPassword && inputPassword !== "love1219**") {
      return res.status(401).json({ error: "관리자 비밀번호가 일치하지 않습니다. ('love1219**' 확인 필요)" });
    }

    console.log("[Vercel API] Received Scraped Property:", property.title || property.id);

    // Supabase 설정 (환경변수 또는 기본값)
    const supabaseUrl = process.env.SUPABASE_URL || "https://ukcbvzyyfzwqotvareil.supabase.co";
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_7ckpmsNs6bQJKtALe898vw_hu0v2xF1";

    const supabaseEndpoint = `${supabaseUrl}/rest/v1/properties`;

    // Supabase DB에 맞게 객체 매핑
    const payload = {
      id: String(property.id || `prop-${Date.now()}`),
      sourceUrl: property.sourceUrl || "",
      sourceSite: property.sourceSite || "",
      title: property.title || "",
      category: property.category || "",
      tradeType: property.tradeType || "",
      dongFloor: property.dongFloor || "",
      price: property.price || "",
      size: property.size || "",
      floor: property.floor || "",
      roomBath: property.roomBath || "",
      maintenance: property.maintenance || "",
      prevDeposit: property.prevDeposit || "",
      direction: property.direction || "",
      entrance: property.entrance || "",
      heating: property.heating || "",
      moveInDate: property.moveInDate || "",
      parking: property.parking || "",
      households: property.households || "",
      buildingUse: property.buildingUse || "",
      approvalDate: property.approvalDate || "",
      address: property.address || "",
      description: property.description || "",
      features: Array.isArray(property.features) ? property.features : [],
      image: property.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
      date: property.date || new Date().toISOString().split("T")[0],
      agentContact: property.agentContact || ""
    };

    // Supabase REST API POST (UPSERT)
    const supabaseRes = await fetch(supabaseEndpoint, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify([payload])
    });

    if (!supabaseRes.ok) {
      const errorText = await supabaseRes.text();
      console.error("[Supabase Error]", supabaseRes.status, errorText);
      throw new Error(`Supabase DB 저장 실패 (HTTP ${supabaseRes.status}): ${errorText}`);
    }

    return res.status(200).json({
      success: true,
      message: "매물이 Supabase DB에 성공적으로 등록되었습니다!",
      savedProperty: payload
    });
  } catch (error) {
    console.error("[Vercel API Error]", error);
    return res.status(500).json({ error: error.message || "서버 내부 오류가 발생했습니다." });
  }
}
