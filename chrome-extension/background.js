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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    let result = {};
    try {
      result = JSON.parse(text);
    } catch (e) {
      // JSON 파싱 실패 시 text 유지
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
        throw new Error(`[${response.status} 서버 에러] Vercel 서버 오류가 발생했습니다.\n(${result.error || text.substring(0, 80)})`);
      }
      throw new Error(`[HTTP ${response.status}] 서버 응답 오류가 발생했습니다.`);
    }

    return {
      success: true,
      message: result.message || "매물이 홈페이지(Vercel)로 성공적으로 전송되었습니다!",
      serverResult: result
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[Background Error]", error);
    const isTimeout = error.name === "AbortError";
    const msg = isTimeout ? "Vercel 서버 응답 대기 시간(12초)이 초과되었습니다. 네트워크 상태나 API 주소를 확인해 주세요." : (error.message || "서버 통신 중 네트워크 오류가 발생했습니다.");
    return {
      success: false,
      error: msg
    };
  }
  }
}
