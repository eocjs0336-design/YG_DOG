/**
 * 양구 애견동반 판별기 MVP - Core Logic
 * 순수 Vanilla JavaScript (ES6+)를 사용하여 정적 데이터를 비동기 fetch하고,
 * 다중 조건 실시간 필터링 및 우선순위 정렬을 지원합니다.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- 상태 관리 변수 ---
  let allPlaces = [];
  let filteredPlaces = [];

  // --- DOM 요소 참조 ---
  const petSizeSelect = document.getElementById("pet-size");
  const purposeSelect = document.getElementById("purpose");
  const prioritySelect = document.getElementById("priority");
  const totalCountEl = document.getElementById("total-count");
  const placesGrid = document.getElementById("places-grid");
  const errorContainer = document.getElementById("error-container");
  const startBtn = document.getElementById("start-btn");
  const filterSection = document.getElementById("finder-form");

  // --- 카테고리별 방문 전 확인 질문 세트 ---
  const questionTemplates = {
    common: [
      "현재도 반려견 동반 입장이 정상적으로 가능한가요?",
      "목줄(리드줄) 외에 배변패드나 추가로 준비해야 할 반려견 동반 필수 품목이 있을까요?"
    ],
    "카페·식당": [
      "반려견과 실내 동반 입장이 가능한가요, 아니면 야외 테라스석만 가능한가요?",
      "이동 가방, 켄넬 또는 개모차(유모차) 지참이 필수 조건인가요?"
    ],
    "숙박": [
      "반려견 동반 투숙 시 마리당 또는 박당 추가 요금이 발생하나요?",
      "객실 내에 반려견 전용 식기나 배변 패드 등 어메니티가 제공되나요?"
    ],
    "관광지": [
      "수목원이나 관광지 내부에서 반려견이 들어갈 수 없는 특정 실내 건물이나 코스가 있나요?",
      "반려견이 오프리쉬(줄 없이)로 뛰어놀 수 있는 전용 놀이터 공간이 따로 마련되어 있나요?"
    ],
    "산책": [
      "산책 코스 주변에 진드기가 많거나 위험할 수 있는 구간이 있나요?",
      "반려견 식수를 보충할 수 있는 식수대나 휴식을 취할 수 있는 그늘 쉼터가 코스 중에 있나요?"
    ]
  };

  // --- 이벤트 바인딩 ---
  if (startBtn && filterSection) {
    startBtn.addEventListener("click", () => {
      filterSection.scrollIntoView({ behavior: "smooth" });
    });
  }

  [petSizeSelect, purposeSelect, prioritySelect].forEach((select) => {
    if (select) {
      select.addEventListener("change", applyFiltersAndSort);
    }
  });

  // --- 초기 데이터 로드 ---
  fetchData();

  /**
   * places.json 파일을 비동기로 조회합니다.
   */
  async function fetchData() {
    try {
      showLoading();
      const response = await fetch("./data/places.json");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      allPlaces = await response.json();
      applyFiltersAndSort();
    } catch (error) {
      console.error("데이터를 가져오는 도중 오류 발생:", error);
      showError("장소 데이터를 불러오는 데 실패했습니다. 네트워크 연결을 확인하고 잠시 후 다시 시도해 주세요.");
    }
  }

  /**
   * 로딩 상태를 표시합니다.
   */
  function showLoading() {
    placesGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <div class="empty-title">데이터를 불러오는 중입니다</div>
        <div class="empty-desc">양구군의 소중한 애견 동반 후보 데이터를 로드하고 있습니다.</div>
      </div>
    `;
  }

  /**
   * 에러 상태를 표시합니다.
   */
  function showError(message) {
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="error-state" role="alert">
          <div class="error-title">데이터 로드 실패</div>
          <p>${message}</p>
        </div>
      `;
      errorContainer.style.display = "block";
    }
    placesGrid.innerHTML = "";
    totalCountEl.textContent = "0";
  }

  /**
   * 필터링 및 정렬 로직을 동시에 실행하고 화면에 반영합니다.
   */
  function applyFiltersAndSort() {
    if (errorContainer) {
      errorContainer.style.display = "none";
    }

    const selectedSize = petSizeSelect.value;
    const selectedPurpose = purposeSelect.value;
    const selectedPriority = prioritySelect.value;

    // 1. 필터링
    filteredPlaces = allPlaces.filter((place) => {
      // 반려견 크기 조건 검증
      const matchSize = selectedSize === "all" || place.petSize.includes(selectedSize);
      
      // 여행 목적 조건 검증
      const matchPurpose = selectedPurpose === "all" || place.purposeTags.includes(selectedPurpose);

      return matchSize && matchPurpose;
    });

    // 2. 정렬
    sortPlaces(selectedPriority);

    // 3. 화면 렌더링
    renderPlaces();
  }

  /**
   * 선택된 정렬 기준에 따라 장소 목록을 정렬합니다.
   * @param {string} criterion 
   */
  function sortPlaces(criterion) {
    filteredPlaces.sort((a, b) => {
      switch (criterion) {
        case "official":
          // 공식 정보 우선: officialUrl이 존재하는 장소 우선
          const aHasOfficial = a.officialUrl ? 1 : 0;
          const bHasOfficial = b.officialUrl ? 1 : 0;
          if (aHasOfficial !== bHasOfficial) {
            return bHasOfficial - aHasOfficial;
          }
          break;
        case "map":
          // 지도 바로가기 우선: 위도/경도가 모두 유효한 장소 우선
          const aHasMap = (a.lat && a.lng) ? 1 : 0;
          const bHasMap = (b.lat && b.lng) ? 1 : 0;
          if (aHasMap !== bHasMap) {
            return bHasMap - aHasMap;
          }
          break;
        case "phone":
          // 전화 확인 우선: phone 정보가 존재하는 장소 우선
          const aHasPhone = a.phone ? 1 : 0;
          const bHasPhone = b.phone ? 1 : 0;
          if (aHasPhone !== bHasPhone) {
            return bHasPhone - aHasPhone;
          }
          break;
        case "trust":
          // 신뢰도 높은 순: A -> B -> C 순
          const gradePriority = { "A": 3, "B": 2, "C": 1 };
          const aGrade = gradePriority[a.trustGrade] || 0;
          const bGrade = gradePriority[b.trustGrade] || 0;
          if (aGrade !== bGrade) {
            return bGrade - aGrade;
          }
          break;
        default:
          break;
      }
      // 동일 조건 또는 기본 정렬인 경우 이름(가나다) 순 정렬
      return a.name.localeCompare(b.name, "ko");
    });
  }

  /**
   * 필터링 및 정렬이 완료된 데이터 리스트를 DOM에 주입합니다.
   */
  function renderPlaces() {
    totalCountEl.textContent = filteredPlaces.length;

    if (filteredPlaces.length === 0) {
      placesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🐶</div>
          <div class="empty-title">검색된 장소가 없습니다</div>
          <div class="empty-desc">조건을 다른 것으로 변경해 보세요. 더 넒은 범위를 설정하시면 후보지가 나옵니다.</div>
        </div>
      `;
      return;
    }

    placesGrid.innerHTML = "";

    filteredPlaces.forEach((place) => {
      const card = document.createElement("article");
      card.className = "place-card";
      card.setAttribute("aria-label", `${place.name} 상세 정보`);

      // 신뢰도 텍스트 뱃지 매핑
      let trustGradeClass = "grade-c";
      let trustGradeText = "C: 참고용 후보";
      if (place.trustGrade === "A") {
        trustGradeClass = "grade-a";
        trustGradeText = "A: 공식 데이터 확인";
      } else if (place.trustGrade === "B") {
        trustGradeClass = "grade-b";
        trustGradeText = "B: 방문 전 확인 권장";
      }

      // 태그 HTML 렌더링
      const petSizeTags = place.petSize.map(size => `<span class="tag tag-size">${size}</span>`).join(" ");
      const purposeTags = place.purposeTags.map(tag => `<span class="tag">${tag}</span>`).join(" ");

      // 포털 외부 검색 링크 생성
      const naverSearch = `https://search.naver.com/search.naver?query=${encodeURIComponent("양구 " + place.name)}`;
      const naverMap = `https://map.naver.com/v5/search/${encodeURIComponent("양구 " + place.name)}`;
      const kakaoMap = `https://map.kakao.com/?q=${encodeURIComponent("양구 " + place.name)}`;
      const googleSearch = `https://www.google.com/search?q=${encodeURIComponent("양구 " + place.name)}`;

      // 전화 링크 및 공식 사이트 생성
      const phoneHtml = place.phone 
        ? `<a href="tel:${place.phone}" class="btn btn-outline" aria-label="${place.name} 전화 문의하기">📞 전화하기</a>`
        : `<button class="btn btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;" aria-label="전화번호 정보 없음">📞 전화 없음</button>`;
      
      const officialHtml = place.officialUrl
        ? `<a href="${place.officialUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" aria-label="${place.name} 공식 홈페이지 새 창 열기">🌐 공식 정보</a>`
        : `<button class="btn btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;" aria-label="공식 홈페이지 없음">🌐 정보 없음</button>`;

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-category">${place.category}</span>
            <h3 class="card-title">${place.name}</h3>
          </div>
          <span class="trust-badge ${trustGradeClass}">${trustGradeText}</span>
        </div>
        
        <p class="card-address">📍 ${place.address}</p>
        
        <div class="card-tags">
          ${petSizeTags}
          ${purposeTags}
        </div>
        
        ${place.petNote ? `<p class="card-note">${place.petNote}</p>` : ""}
        
        <div class="card-portals">
          <a href="${naverMap}" target="_blank" rel="noopener noreferrer" class="portal-link">🗺️ 네이버 지도</a>
          <a href="${kakaoMap}" target="_blank" rel="noopener noreferrer" class="portal-link">🗺️ 카카오맵</a>
          <a href="${naverSearch}" target="_blank" rel="noopener noreferrer" class="portal-link">🔍 네이버 검색</a>
          <a href="${googleSearch}" target="_blank" rel="noopener noreferrer" class="portal-link">🔍 구글 검색</a>
        </div>
        
        <div class="card-actions">
          ${phoneHtml}
          ${officialHtml}
          <button class="btn btn-primary btn-share" data-id="${place.id}" data-name="${place.name}" aria-label="${place.name} 공유하기">🔗 공유하기</button>
        </div>

        <div class="question-accordion" id="accordion-${place.id}">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="content-${place.id}">
            💡 방문 전 필수 확인 질문 목록
          </button>
          <div class="accordion-content" id="content-${place.id}">
            <ul class="question-list">
              <!-- JS에서 카테고리별 맞춤 질문 동적 주입 -->
            </ul>
          </div>
        </div>
        
        <div class="card-footer">
          <span>출처: ${place.sourceName}</span>
          <span>갱신일: ${place.lastUpdated}</span>
        </div>
      `;

      // 확인 질문 렌더링 및 클릭 이벤트 핸들링
      const accordion = card.querySelector(`#accordion-${place.id}`);
      const trigger = card.querySelector(".accordion-trigger");
      const list = card.querySelector(".question-list");

      // 템플릿 질문 조합
      const finalQuestions = [...questionTemplates.common];
      const categoryTag = place.category;
      if (questionTemplates[categoryTag]) {
        finalQuestions.push(...questionTemplates[categoryTag]);
      } else {
        // 매칭되는 특수 카테고리가 없을 시 태그 매칭 시도
        place.purposeTags.forEach(tag => {
          if (questionTemplates[tag] && !finalQuestions.includes(questionTemplates[tag][0])) {
            finalQuestions.push(...questionTemplates[tag]);
          }
        });
      }

      finalQuestions.forEach((qText) => {
        const li = document.createElement("li");
        li.className = "question-item";
        li.innerHTML = `
          <span class="question-text">❓ ${qText}</span>
          <button class="btn-copy-question" data-text="${qText}">복사하기</button>
        `;
        list.appendChild(li);
      });

      // 아코디언 열고 닫기 로직
      trigger.addEventListener("click", () => {
        const isActive = accordion.classList.contains("active");
        if (isActive) {
          accordion.classList.remove("active");
          trigger.setAttribute("aria-expanded", "false");
        } else {
          accordion.classList.add("active");
          trigger.setAttribute("aria-expanded", "true");
        }
      });

      // 질문 복사 로직
      card.querySelectorAll(".btn-copy-question").forEach((copyBtn) => {
        copyBtn.addEventListener("click", (e) => {
          const textToCopy = e.target.getAttribute("data-text");
          copyToClipboard(textToCopy, "질문이 클립보드에 복사되었습니다.");
        });
      });

      // 공유하기 로직
      const shareBtn = card.querySelector(".btn-share");
      shareBtn.addEventListener("click", () => {
        const placeName = shareBtn.getAttribute("data-name");
        const shareData = {
          title: `[양구 애견동반 판별기] ${placeName}`,
          text: `반려견과 함께 가기 좋은 양구군 "${placeName}"의 정보와 방문 전 확인사항을 확인해보세요!`,
          url: window.location.href
        };

        if (navigator.share) {
          navigator.share(shareData)
            .catch((err) => {
              console.log("Web Share API 에러 또는 취소:", err);
              // 폴백: 링크 복사
              copyToClipboard(window.location.href, "장소 정보 링크가 클립보드에 복사되었습니다.");
            });
        } else {
          copyToClipboard(window.location.href, "장소 정보 링크가 클립보드에 복사되었습니다.");
        }
      });

      placesGrid.appendChild(card);
    });
  }

  /**
   * 지정한 텍스트를 클립보드에 복사하고 알림 메시지를 표시합니다.
   * @param {string} text 
   * @param {string} message 
   */
  function copyToClipboard(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(message);
        })
        .catch((err) => {
          console.error("클립보드 복사 실패:", err);
          fallbackCopyToClipboard(text, message);
        });
    } else {
      fallbackCopyToClipboard(text, message);
    }
  }

  /**
   * navigator.clipboard 미지원 브라우저용 레거시 폴백 함수
   */
  function fallbackCopyToClipboard(text, message) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";  // 화면 밖으로 배치
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        showToast(message);
      } else {
        alert("복사에 실패했습니다. 직접 복사해주세요.");
      }
    } catch (err) {
      console.error("레거시 복사 에러:", err);
    }
    document.body.removeChild(textarea);
  }

  /**
   * 화면 중앙 아래에 일시적인 토스트 팝업을 표시합니다.
   * @param {string} message 
   */
  function showToast(message) {
    // 기존 토스트 제거
    const existingToast = document.querySelector(".toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // 하드웨어 가속 유도를 위해 브라우저 리플로우 실행
    void toast.offsetWidth;

    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2000);
  }
});
