/**
 * 양구, 발걸음 가볍개 - 양구군 반려동물 동반 지도 판별기 MVP Controller
 * 순수 Vanilla JavaScript (ES6+) 기반으로 Leaflet.js 지도와 필터 데이터를 연동합니다.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- 애플리케이션 상태 (State) ---
  const state = {
    places: [],
    filteredPlaces: [],
    selectedCategory: "전체",
    searchQuery: "",
    selectedConditions: [], // ['소형견', '중형견', '대형견']
    selectedPlaceId: null,
    
    // 지도 인스턴스
    mapInstance: null,
    mapMarkers: [],
    
    // 모바일 뷰 ('list' 또는 'map')
    activeView: "list"
  };

  // --- 카테고리별 방문 전 확인 질문 템플릿 ---
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

  // --- DOM 요소 참조 ---
  const searchInput = document.getElementById("search-input");
  const searchClearBtn = document.getElementById("search-clear-btn");
  const categoryBtns = document.querySelectorAll(".category-btn");
  const conditionChips = document.querySelectorAll(".condition-chip");
  const prioritySelect = document.getElementById("priority-select");
  
  const placesList = document.getElementById("places-list");
  const placeCountEl = document.getElementById("place-count");
  const btnResetFilters = document.getElementById("btn-reset-filters");
  
  const btnMobileToggle = document.getElementById("btn-mobile-toggle");
  const appContainer = document.querySelector(".app-container");
  
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const btnDetailClose = document.getElementById("btn-detail-close");
  const panelBackdrop = document.getElementById("panel-backdrop");
  
  const btnLogo = document.getElementById("btn-logo");

  // --- 초기 실행 ---
  fetchData();
  initEventListeners();

  /**
   * places.json 비동기 패치 및 초기 렌더링
   */
  async function fetchData() {
    try {
      const response = await fetch("./data/places.json");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      state.places = await response.json();
      state.filteredPlaces = [...state.places];
      
      // 지도 초기화
      initMap();
      
      // 필터 및 렌더링
      applyFiltersAndSort();
    } catch (error) {
      console.error("데이터 로드 중 오류가 발생했습니다:", error);
      showErrorState("장소 데이터를 불러오는 데 실패했습니다. 네트워크 연결을 확인하고 새로고침해 주세요.");
    }
  }

  /**
   * 에러 발생 시 UI 처리
   */
  function showErrorState(message) {
    placesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">데이터 로드 실패</div>
        <div class="empty-desc">${message}</div>
      </div>
    `;
    placeCountEl.textContent = "0";
  }

  /**
   * Leaflet 지도를 양구읍 중심부로 초기화
   */
  function initMap() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    // 양구군 중심 좌표로 설정
    state.mapInstance = L.map("map", {
      zoomControl: false // 기본 줌 단추 비활성화 후 위치 조정 추가
    }).setView([38.105, 127.990], 12);

    // OpenStreetMap 타일 등록
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(state.mapInstance);

    // 줌 컨트롤러를 우측 상단으로 이동배치
    L.control.zoom({ position: "topright" }).addTo(state.mapInstance);
  }

  /**
   * 필터링된 장소 데이터를 바탕으로 지도 마커 재생성
   */
  function updateMapMarkers() {
    if (!state.mapInstance) return;

    // 기존 마커 전체 제거
    state.mapMarkers.forEach((marker) => state.mapInstance.removeLayer(marker));
    state.mapMarkers = [];

    // 필터링된 장소들을 지도에 핀으로 표시
    state.filteredPlaces.forEach((place) => {
      if (!place.lat || !place.lng) return;

      const lat = parseFloat(place.lat);
      const lng = parseFloat(place.lng);
      const categoryClass = getCategoryClass(place.category);

      // 커스텀 핀마커 DivIcon 생성
      const markerHtml = `
        <div class="custom-pin pin-${categoryClass} ${state.selectedPlaceId === place.id ? 'active' : ''}" id="marker-pin-${place.id}">
          <div class="pin-shadow"></div>
          <div class="pin-body">
            <span class="pin-icon">${getCategoryEmoji(place.category)}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-div-icon",
        iconSize: [36, 42],
        iconAnchor: [18, 42]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(state.mapInstance);
      
      // 마커 클릭 시 해당 장소 상세 정보 로드
      marker.on("click", () => {
        selectPlace(place.id);
      });

      state.mapMarkers.push(marker);
    });
  }

  /**
   * 카테고리별 이모지 뱃지 매핑
   */
  function getCategoryEmoji(category) {
    switch (category) {
      case "숙박": return "🏕️";
      case "카페·식당": return "☕";
      case "관광지": return "🌳";
      case "산책": return "🐾";
      default: return "🐾";
    }
  }

  /**
   * 카테고리별 CSS 컬러 스타일 클래스 매핑
   */
  function getCategoryClass(category) {
    switch (category) {
      case "숙박": return "lodge";
      case "카페·식당": return "food";
      case "관광지": return "attract";
      case "산책": return "walk";
      default: return "default";
    }
  }

  /**
   * 실시간 필터 및 정렬 적용
   */
  function applyFiltersAndSort() {
    const query = state.searchQuery.toLowerCase().trim();
    const cat = state.selectedCategory;
    const priority = prioritySelect.value;

    state.filteredPlaces = state.places.filter((place) => {
      // 1. 텍스트 검색 (이름, 주소, 메모)
      const matchesSearch = !query || 
                            place.name.toLowerCase().includes(query) ||
                            place.address.toLowerCase().includes(query) ||
                            (place.petNote && place.petNote.toLowerCase().includes(query));

      // 2. 카테고리 필터
      const matchesCategory = cat === "전체" || place.category === cat;

      // 3. 반려견 조건 칩 필터 (선택된 모든 반려견 조건을 만족해야 통과 - And 연산)
      const matchesConditions = state.selectedConditions.every((cond) => {
        return place.petSize.includes(cond);
      });

      return matchesSearch && matchesCategory && matchesConditions;
    });

    // 4. 정렬
    sortFilteredPlaces(priority);

    // 5. 화면 갱신
    renderPlaces();
    updateMapMarkers();
  }

  /**
   * 기획안의 4가지 우선순위 기준 정렬 처리
   */
  function sortFilteredPlaces(criterion) {
    state.filteredPlaces.sort((a, b) => {
      switch (criterion) {
        case "official":
          const aHasOfficial = a.officialUrl ? 1 : 0;
          const bHasOfficial = b.officialUrl ? 1 : 0;
          if (aHasOfficial !== bHasOfficial) return bHasOfficial - aHasOfficial;
          break;
        case "map":
          const aHasCoords = (a.lat && a.lng) ? 1 : 0;
          const bHasCoords = (b.lat && b.lng) ? 1 : 0;
          if (aHasCoords !== bHasCoords) return bHasCoords - aHasCoords;
          break;
        case "phone":
          const aHasPhone = a.phone ? 1 : 0;
          const bHasPhone = b.phone ? 1 : 0;
          if (aHasPhone !== bHasPhone) return bHasPhone - aHasPhone;
          break;
        case "trust":
          const gradeScore = { "A": 3, "B": 2, "C": 1 };
          const aScore = gradeScore[a.trustGrade] || 0;
          const bScore = gradeScore[b.trustGrade] || 0;
          if (aScore !== bScore) return bScore - aScore;
          break;
        default:
          break;
      }
      return a.name.localeCompare(b.name, "ko");
    });
  }

  /**
   * 사이드바 내 장소 카드 리스트 렌더링
   */
  function renderPlaces() {
    placeCountEl.textContent = state.filteredPlaces.length;
    placesList.innerHTML = "";

    if (state.filteredPlaces.length === 0) {
      placesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🐶</div>
          <div class="empty-title">검색된 장소가 없습니다</div>
          <div class="empty-desc">필터 조건을 다르게 변경해 보시거나, 다른 단어로 재검색해 주세요.</div>
        </div>
      `;
      return;
    }

    state.filteredPlaces.forEach((place) => {
      const card = document.createElement("article");
      const categoryClass = getCategoryClass(place.category);
      
      // 카드 활성화 여부
      const isActive = state.selectedPlaceId === place.id;
      card.className = `place-card ${isActive ? 'active' : ''}`;
      card.id = `place-card-${place.id}`;
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `${place.name} 상세 정보 보기`);

      // 신뢰도 텍스트 뱃지 매핑
      let trustGradeClass = "grade-c";
      let trustGradeText = "C: 참고용 후보";
      if (place.trustGrade === "A") {
        trustGradeClass = "grade-a";
        trustGradeText = "A: 공식 데이터";
      } else if (place.trustGrade === "B") {
        trustGradeClass = "grade-b";
        trustGradeText = "B: 확인 권장";
      }

      // 태그 렌더링
      const petSizeTags = place.petSize.map(size => `<span class="card-tag">${size}</span>`).join("");

      card.innerHTML = `
        <div class="card-top">
          <h3 class="card-title">${place.name}</h3>
          <span class="card-category-badge ${categoryClass}">${place.category}</span>
        </div>
        <p class="card-address">${place.address}</p>
        <div class="card-tags">
          ${petSizeTags}
        </div>
        <span class="card-trust-badge ${trustGradeClass}">${trustGradeText}</span>
      `;

      // 카드 클릭 시 장소 선택 및 상세 패널 오픈
      card.addEventListener("click", () => {
        selectPlace(place.id);
      });

      // 키보드 엔터 지원
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          selectPlace(place.id);
        }
      });

      placesList.appendChild(card);
    });
  }

  /**
   * 특정 장소를 선택하고 지도를 연동하는 액션 처리
   */
  function selectPlace(placeId) {
    state.selectedPlaceId = placeId;
    const place = state.places.find((p) => p.id === placeId);
    if (!place) return;

    // 1. 사이드바 카드 목록 활성화 스타일 갱신
    document.querySelectorAll(".place-card").forEach((card) => {
      card.classList.remove("active");
    });
    const activeCard = document.getElementById(`place-card-${placeId}`);
    if (activeCard) {
      activeCard.classList.add("active");
      // 자연스럽게 스크롤 이동
      activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // 2. 지도 위의 마커 핀 활성화 스타일 갱신
    document.querySelectorAll(".custom-pin").forEach((pin) => {
      pin.classList.remove("active");
    });
    const activePin = document.getElementById(`marker-pin-${placeId}`);
    if (activePin) {
      activePin.classList.add("active");
    }

    // 3. 지도를 해당 위치로 부드럽게 15레벨 줌 이동
    if (state.mapInstance && place.lat && place.lng) {
      state.mapInstance.setView([place.lat, place.lng], 15, { animate: true });
    }

    // 4. 상세 슬라이드 정보 패널 렌더링 및 슬라이딩 오픈
    renderDetailPanel(place);
    openDetailPanel();

    // 5. 모바일 뷰인 경우 강제 지도 화면 활성화로 매끄러운 뷰 전환
    if (window.innerWidth <= 768 && state.activeView === "list") {
      toggleMobileView();
    }
  }

  /**
   * 상세 패널 내 장소 세부 정보, 포털 아웃링크 4종, 질문 아코디언, 복사, 공유 기능 렌더링
   */
  function renderDetailPanel(place) {
    let trustGradeClass = "grade-c";
    let trustGradeText = "C: 참고용 후보";
    if (place.trustGrade === "A") {
      trustGradeClass = "grade-a";
      trustGradeText = "A: 공식 데이터 확인";
    } else if (place.trustGrade === "B") {
      trustGradeClass = "grade-b";
      trustGradeText = "B: 방문 전 확인 권장";
    }

    // 포털 검색 아웃링크 4종 동적 주입
    const naverSearch = `https://search.naver.com/search.naver?query=${encodeURIComponent("양구 " + place.name)}`;
    const naverMap = `https://map.naver.com/v5/search/${encodeURIComponent("양구 " + place.name)}`;
    const kakaoMap = `https://map.kakao.com/?q=${encodeURIComponent("양구 " + place.name)}`;
    const googleSearch = `https://www.google.com/search?q=${encodeURIComponent("양구 " + place.name)}`;

    // 숙소나 매장 사진 매칭 (Unsplash 무료 강아지 여행 소스 사용)
    let imageUrl = "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=800";
    if (place.category === "숙박") {
      imageUrl = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800";
    } else if (place.category === "카페·식당") {
      imageUrl = "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=800";
    } else if (place.category === "산책") {
      imageUrl = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800";
    }

    const phoneHtml = place.phone 
      ? `<a href="tel:${place.phone}" class="details-btn details-btn-primary" aria-label="${place.name} 전화 문의하기">📞 전화하기</a>`
      : `<button class="details-btn details-btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;" aria-label="전화번호 없음">📞 전화 없음</button>`;
    
    const officialHtml = place.officialUrl
      ? `<a href="${place.officialUrl}" target="_blank" rel="noopener noreferrer" class="details-btn details-btn-outline" aria-label="${place.name} 공식 홈페이지 가기">🌐 공식 정보</a>`
      : `<button class="details-btn details-btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;" aria-label="공식 홈페이지 없음">🌐 정보 없음</button>`;

    // 상세 내용 바인딩
    detailContent.innerHTML = `
      <div class="details-image-container">
        <img src="${imageUrl}" alt="${place.name} 대표 이미지" class="details-image">
      </div>

      <div class="details-header">
        <div class="details-title-block">
          <h2 class="details-title">${place.name}</h2>
          <span class="details-trust-badge ${trustGradeClass}">${trustGradeText}</span>
        </div>
        <p class="details-address">📍 ${place.address}</p>
      </div>

      ${place.petNote ? `<p class="details-note">${place.petNote}</p>` : ""}

      <!-- 4대 포털 바로가기 영역 -->
      <div class="details-portals" role="region" aria-label="포털 검색 및 지도 바로가기">
        <a href="${naverMap}" target="_blank" rel="noopener noreferrer" class="portal-btn">🗺️ 네이버 지도</a>
        <a href="${kakaoMap}" target="_blank" rel="noopener noreferrer" class="portal-btn">🗺️ 카카오맵</a>
        <a href="${naverSearch}" target="_blank" rel="noopener noreferrer" class="portal-btn">🔍 네이버 검색</a>
        <a href="${googleSearch}" target="_blank" rel="noopener noreferrer" class="portal-btn">🔍 구글 검색</a>
      </div>

      <!-- 전화 및 홈페이지 아웃링크 -->
      <div class="details-actions">
        ${phoneHtml}
        ${officialHtml}
      </div>
      
      <!-- 공유하기 버튼 -->
      <button class="details-btn details-btn-outline btn-detail-share" data-id="${place.id}" data-name="${place.name}">
        🔗 장소 정보 공유하기
      </button>

      <!-- 아코디언 확인 질문 목록 -->
      <div class="details-accordion" id="detail-accordion-${place.id}">
        <button class="accordion-head" aria-expanded="false" aria-controls="accordion-body-${place.id}">
          💡 방문 전 필수 확인 질문 목록
        </button>
        <div class="accordion-body" id="accordion-body-${place.id}">
          <ul class="question-ul">
            <!-- JS에서 동적 질문 추가 -->
          </ul>
        </div>
      </div>

      <div style="margin-top: auto; padding-top: 15px; font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>데이터 출처: ${place.sourceName}</span>
        <span>최종 갱신일: ${place.lastUpdated}</span>
      </div>
    `;

    // 5. 아코디언 질문 데이터 바인딩
    const accordion = detailContent.querySelector(`#detail-accordion-${place.id}`);
    const trigger = detailContent.querySelector(".accordion-head");
    const list = detailContent.querySelector(".question-ul");

    // 공통 질문 장착
    const finalQuestions = [...questionTemplates.common];
    const category = place.category;
    if (questionTemplates[category]) {
      finalQuestions.push(...questionTemplates[category]);
    }

    finalQuestions.forEach((qText) => {
      const li = document.createElement("li");
      li.className = "question-li";
      li.innerHTML = `
        <span class="question-text-span">❓ ${qText}</span>
        <button class="question-copy-btn" data-text="${qText}">질문 복사</button>
      `;
      list.appendChild(li);
    });

    // 아코디언 토글 이벤트
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

    // 개별 질문 복사
    detailContent.querySelectorAll(".question-copy-btn").forEach((copyBtn) => {
      copyBtn.addEventListener("click", (e) => {
        const text = e.target.getAttribute("data-text");
        copyToClipboard(text, "확인 질문이 복사되었습니다.");
      });
    });

    // 장소 공유하기
    const shareBtn = detailContent.querySelector(".btn-detail-share");
    shareBtn.addEventListener("click", () => {
      const shareData = {
        title: `[양구 애견동반 판별기] ${place.name}`,
        text: `반려견과 가기 좋은 양구군 "${place.name}" 정보와 질문 리스트를 확인해 보세요!`,
        url: window.location.href
      };

      if (navigator.share) {
        navigator.share(shareData).catch((err) => {
          console.log("공유 API 에러 또는 취소:", err);
          copyToClipboard(window.location.href, "장소 정보 링크가 클립보드에 복사되었습니다.");
        });
      } else {
        copyToClipboard(window.location.href, "장소 정보 링크가 클립보드에 복사되었습니다.");
      }
    });
  }

  /**
   * 상세 정보 패널 활성화
   */
  function openDetailPanel() {
    detailPanel.classList.add("open");
    detailPanel.setAttribute("aria-hidden", "false");
    panelBackdrop.classList.add("open");
  }

  /**
   * 상세 정보 패널 비활성화
   */
  function closeDetailPanel() {
    detailPanel.classList.remove("open");
    detailPanel.setAttribute("aria-hidden", "true");
    panelBackdrop.classList.remove("open");
    state.selectedPlaceId = null;
    
    // 카드 활성화 해제
    document.querySelectorAll(".place-card").forEach((card) => card.classList.remove("active"));
    
    // 마커 핀 활성화 해제
    document.querySelectorAll(".custom-pin").forEach((pin) => pin.classList.remove("active"));
  }

  /**
   * 모바일 화면 전환 로직 (목록 뷰 <-> 지도 뷰)
   */
  function toggleMobileView() {
    if (state.activeView === "list") {
      state.activeView = "map";
      appContainer.classList.add("view-map");
      btnMobileToggle.querySelector("span").textContent = "목록 보기";
      btnMobileToggle.querySelector("i").setAttribute("data-lucide", "list");
      btnMobileToggle.setAttribute("aria-label", "목록 보기로 전환");
      
      // Leaflet 지도가 레이아웃이 바뀐 후 찌그러지지 않도록 즉시 크기 재계산 지시
      if (state.mapInstance) {
        setTimeout(() => {
          state.mapInstance.invalidateSize();
        }, 100);
      }
    } else {
      state.activeView = "list";
      appContainer.classList.remove("view-map");
      btnMobileToggle.querySelector("span").textContent = "지도 보기";
      btnMobileToggle.querySelector("i").setAttribute("data-lucide", "map");
      btnMobileToggle.setAttribute("aria-label", "지도 보기로 전환");
    }
    
    // Lucide 아이콘 다시 그리기
    lucide.createIcons();
  }

  /**
   * 텍스트 복사 핸들러
   */
  function copyToClipboard(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast(message))
        .catch((err) => {
          console.error("클립보드 API 에러:", err);
          fallbackCopy(text, message);
        });
    } else {
      fallbackCopy(text, message);
    }
  }

  /**
   * 레거시 복사 폴백
   */
  function fallbackCopy(text, message) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand("copy");
      if (success) {
        showToast(message);
      } else {
        alert("복사 기능이 작동하지 않습니다. 텍스트를 직접 복사해 주세요.");
      }
    } catch (err) {
      console.error("레거시 복사 에러:", err);
    }
    document.body.removeChild(textarea);
  }

  /**
   * 토스트 팝업 띄우기
   */
  function showToast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    void toast.offsetWidth; // reflow

    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * 전체 이벤트 리스너 바인딩
   */
  function initEventListeners() {
    // 1. 텍스트 검색창
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery.trim().length > 0) {
        searchClearBtn.classList.remove("hidden");
      } else {
        searchClearBtn.classList.add("hidden");
      }
      applyFiltersAndSort();
    });

    // 2. 검색창 지우기
    searchClearBtn.addEventListener("click", () => {
      searchInput.value = "";
      state.searchQuery = "";
      searchClearBtn.classList.add("hidden");
      applyFiltersAndSort();
      searchInput.focus();
    });

    // 3. 카테고리 탭 버튼
    categoryBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        categoryBtns.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        
        const targetBtn = e.currentTarget;
        targetBtn.classList.add("active");
        targetBtn.setAttribute("aria-selected", "true");
        
        state.selectedCategory = targetBtn.getAttribute("data-category");
        applyFiltersAndSort();
      });
    });

    // 4. 반려견 크기 조건 칩
    conditionChips.forEach((chip) => {
      chip.addEventListener("click", (e) => {
        const target = e.currentTarget;
        const condition = target.getAttribute("data-condition");
        
        if (target.classList.contains("active")) {
          target.classList.remove("active");
          state.selectedConditions = state.selectedConditions.filter(c => c !== condition);
        } else {
          target.classList.add("active");
          state.selectedConditions.push(condition);
        }
        applyFiltersAndSort();
      });
    });

    // 5. 정렬 기준 변경
    prioritySelect.addEventListener("change", applyFiltersAndSort);

    // 6. 필터 초기화 버튼
    btnResetFilters.addEventListener("click", () => {
      searchInput.value = "";
      state.searchQuery = "";
      searchClearBtn.classList.add("hidden");

      categoryBtns.forEach((btn) => {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      });
      document.querySelector('[data-category="전체"]').classList.add("active");
      state.selectedCategory = "전체";

      conditionChips.forEach((chip) => chip.classList.remove("active"));
      state.selectedConditions = [];

      prioritySelect.value = "trust";

      closeDetailPanel();
      applyFiltersAndSort();
      
      // 지도 원래 축척으로 복귀
      if (state.mapInstance) {
        state.mapInstance.setView([38.105, 127.990], 12);
      }
    });

    // 7. 모바일 뷰포트 전환 단추
    btnMobileToggle.addEventListener("click", toggleMobileView);

    // 8. 상세 패널 닫기 및 백드롭 클릭
    btnDetailClose.addEventListener("click", closeDetailPanel);
    panelBackdrop.addEventListener("click", closeDetailPanel);

    // 9. 로고 클릭 시 필터 리셋
    btnLogo.addEventListener("click", () => {
      btnResetFilters.click();
    });
  }

  // Lucide 아이콘 초기 빌드 호출
  setTimeout(() => {
    if (window.lucide) {
      lucide.createIcons();
    }
  }, 100);
});
