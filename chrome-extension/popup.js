document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const adminPasswordInput = document.getElementById("adminPassword");
  const btnExtract = document.getElementById("btnExtract");
  const btnSend = document.getElementById("btnSend");
  const statusBox = document.getElementById("statusBox");
  const previewBox = document.getElementById("previewBox");

  // 기본 API URL (현재 호스트 / Vercel 배포 주소 설정 가능)
  const DEFAULT_API_URL = "https://jslovelcw-lainding-page.vercel.app/api/save-property";

  // 저장된 설정 불러오기
  chrome.storage.local.get(["apiUrl", "adminPassword"], (saved) => {
    apiUrlInput.value = saved.apiUrl || DEFAULT_API_URL;
    adminPasswordInput.value = saved.adminPassword || "love1219**";
  });

  // 설정 변경 시 자동 저장
  apiUrlInput.addEventListener("input", () => {
    chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim() });
  });

  adminPasswordInput.addEventListener("input", () => {
    chrome.storage.local.set({ adminPassword: adminPasswordInput.value.trim() });
  });

  // 1. DOM 데이터 미리보기 클릭
  btnExtract.addEventListener("click", async () => {
    try {
      showStatus("현재 페이지에서 데이터를 추출하고 있습니다...", "info");
      const data = await extractFromActiveTab();
      previewBox.innerText = JSON.stringify(data, null, 2);
      showStatus("✅ 매물 데이터 추출 성공!", "success");
    } catch (error) {
      showStatus("❌ 추출 실패: " + error.message, "error");
    }
  });

  // 2. 홈페이지로 전송 클릭
  btnSend.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim();
    const adminPassword = adminPasswordInput.value.trim();

    if (!apiUrl) {
      showStatus("⚠️ Vercel API Endpoint 주소를 입력해주세요.", "error");
      return;
    }

    try {
      showStatus("1/2단계: 페이지 DOM에서 매물 정보 추출 중...", "info");
      const propertyData = await extractFromActiveTab();

      previewBox.innerText = JSON.stringify(propertyData, null, 2);

      showStatus("2/2단계: Vercel 서버로 데이터를 전송하고 있습니다...", "info");

      // Background script로 데이터 전송 요청
      chrome.runtime.sendMessage({
        action: "SEND_TO_VERCEL",
        payload: propertyData,
        apiUrl: apiUrl,
        adminPassword: adminPassword
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus("❌ 전송 실패: " + chrome.runtime.lastError.message, "error");
          return;
        }

        if (response && response.success) {
          showStatus("🎉 " + response.message, "success");
        } else {
          showStatus("❌ 전송 실패: " + (response ? response.error : "응답 없음"), "error");
        }
      });

    } catch (error) {
      showStatus("❌ 오류 발생: " + error.message, "error");
    }
  });

  /**
   * 현재 활성화된 탭에 Content Script 실행 및 메시지 전송
   */
  async function extractFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error("활성화된 탭을 찾을 수 없습니다.");
    }

    if (!tab.url || (!tab.url.includes("naver.com") && !tab.url.includes("neonet") && !tab.url.includes("landbank"))) {
      throw new Error("네이버 부동산 또는 부동산뱅크 상세 페이지에서 실행해 주세요.");
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PROPERTY" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script가 로드되지 않은 경우 스크립트 강제 주입 후 다시 시도
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          }, () => {
            if (chrome.runtime.lastError) {
              return reject(new Error("페이지 접근 권한이 없거나 지원되지 않는 탭입니다."));
            }
            chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PROPERTY" }, (res) => {
              if (res && res.success) resolve(res.data);
              else reject(new Error(res ? res.error : "데이터를 추출할 수 없습니다."));
            });
          });
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response ? response.error : "응답 데이터가 없습니다."));
        }
      });
    });
  }

  /**
   * 상태 메시지 출력 함수
   */
  function showStatus(msg, type) {
    statusBox.className = "status-box " + type;
    statusBox.innerText = msg;
    statusBox.style.display = "block";
  }
});
