/**
 * Vercel Serverless Function: /api/save-property
 * Chrome 익스텐션에서 전송한 매물 JSON 데이터를 수집하여 GitHub 저장소 또는 로컬에 저장
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

    // 비밀번호가 제공된 경우 유효성 검사 (love1219** 기본값도 함께 지원)
    if (inputPassword && inputPassword !== adminPassword && inputPassword !== "love1219**") {
      return res.status(401).json({ error: "관리자 비밀번호가 일치하지 않습니다. ('love1219**' 확인 필요)" });
    }

    console.log("[Vercel API] Recieved Scraped Property:", property.title || property.id);

    // GitHub API 저장 설정 (환경 변수 또는 기본값)
    const githubToken = (process.env.GITHUB_TOKEN || "").trim();
    const githubOwner = process.env.GITHUB_OWNER || "lcw52564461-alt";
    const githubRepo = process.env.GITHUB_REPO || "jslovelcw-lainding_page";
    const dataFilePath = "data/properties.json";

    let updated = false;

    if (githubToken && githubOwner && githubRepo) {
      const githubUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${dataFilePath}`;

      // 1. 기존 properties.json 조회
      const getRes = await fetch(githubUrl, {
        headers: {
          "Authorization": `token ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Vercel-Property-Saver"
        }
      });

      let existingProperties = [];
      let sha = "";

      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
        const decodedContent = Buffer.from(fileInfo.content, "base64").toString("utf-8");
        try {
          existingProperties = JSON.parse(decodedContent);
        } catch (e) {
          existingProperties = [];
        }
      }

      // 2. 매물 중복 확인 및 추가
      const existingIdx = existingProperties.findIndex(p => String(p.id) === String(property.id));
      if (existingIdx >= 0) {
        existingProperties[existingIdx] = { ...existingProperties[existingIdx], ...property };
      } else {
        existingProperties.unshift(property);
      }

      // 3. GitHub에 properties.json 커밋 (업데이트)
      const newContentBase64 = Buffer.from(JSON.stringify(existingProperties, null, 2), "utf-8").toString("base64");
      const putRes = await fetch(githubUrl, {
        method: "PUT",
        headers: {
          "Authorization": `token ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "Vercel-Property-Saver"
        },
        body: JSON.stringify({
          message: `feat(property): add scraped property [${property.title || property.id}] via Chrome Extension`,
          content: newContentBase64,
          sha: sha || undefined
        })
      });

      if (putRes.ok) {
        updated = true;
      }
    }

    return res.status(200).json({
      success: true,
      message: "매물이 성공적으로 등록되었습니다!",
      savedProperty: property,
      githubUpdated: updated
    });
  } catch (error) {
    console.error("[Vercel API Error]", error);
    return res.status(500).json({ error: error.message || "서버 내부 오류가 발생했습니다." });
  }
}
