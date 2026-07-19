/**
 * Chrome Extension Background Service Worker (Manifest V3)
 * 홈페이지 Vercel API Endpoint로 POST 요청 전송
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SEND_TO_VERCEL") {
    handleSendToVercel(request.payload, request.apiUrl, request.adminPassword)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 비동기 sendResponse를 위해 true 반환
  }
});

/**
 * Vercel Endpoint로 데이터 POST 전송
 */
async function handleSendToVercel(propertyData, apiUrl, adminPassword) {
  if (!apiUrl) {
    throw new Error("Vercel API 주소가 입력되지 않았습니다. 팝업 설정에서 API URL을 입력해 주세요.");
  }

  console.log("[Background] Sending data to Vercel API:", apiUrl, propertyData);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": adminPassword || ""
      },
      body: JSON.stringify({
        password: adminPassword || "love1219**",
        property: propertyData
      })
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    let result = {};
    try {
      result = JSON.parse(text);
    } catch (e) {
      // JSON 파싱 실패시 text 유지
    }

    // 1. 응답 상태가 200 OK가 아닌 경우 예외 처리
    if (!response.ok) {
      if (result && (result.error || result.message)) {
        throw new Error(result.error || result.message);
      }
      if (response.status === 404) {
        throw new Error(`[404 에러] API 주소를 찾을 수 없습니다.\n입력된 URL: ${apiUrl}\n💡 올바른 경로: /api/save-property (끝에 'erty' 포함 여부 확인)`);
      }
      if (response.status === 401) {
        throw new Error(`[401 에러] 관리자 비밀번호가 일치하지 않습니다. 입력된 비밀번호를 다시 확인해 주세요.`);
      }
      if (response.status >= 500) {
        throw new Error(`[${response.status} 서버 에러] Vercel 서버 내부 오류가 발생했습니다.\nVercel 대시보드의 함수 로그(Logs)를 확인해 주세요.`);
      }
      throw new Error(`[HTTP ${response.status}] 서버 응답 오류가 발생했습니다.`);
    }

    // 2. JSON 파싱 검사
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`서버 응답이 JSON 형식이 아닙니다.\n서버 주소가 잘못되었거나 HTML 에러 페이지가 반환되었습니다.\n(응답 내용: ${text.substring(0, 60)}...)`);
    }

    return {
      success: true,
      message: "매물이 홈페이지(Vercel)로 성공적으로 전송되었습니다!",
      serverResult: result
    };
  } catch (error) {
    console.error("[Background Error]", error);
    return {
      success: false,
      error: error.message || "서버 통신 중 네트워크 오류가 발생했습니다."
    };
  }
}
