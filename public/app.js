// ===== 골프장 / 코스 데이터 (드롭다운용) =====
// 골프장마다 코스 목록이 다르다. 골프장을 고르면 그에 맞는 코스가 채워진다.
const GOLF_CLUBS = {
  "남서울CC": ["동코스", "서코스"],
  "레이크사이드CC": ["남코스", "동코스", "서코스"],
  "베어크리크GC": ["크리크코스", "베어코스", "퍼블릭코스"],
  "스카이72GC": ["하늘코스", "바다코스", "오션코스", "클래식코스"],
  "이천뉴스프링빌CC": ["스프링코스", "빌코스"],
};

// ===== 공통 도우미 =====
const $ = (sel) => document.querySelector(sel);
const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "요청 실패");
  }
  return res.json();
};
const pad2 = (n) => String(n).padStart(2, "0");

// ===== 인증 / 화면 전환 =====
async function init() {
  const me = await api("/api/me");
  if (me.authRequired && !me.authed) {
    showLogin();
  } else {
    showApp();
  }
}

function showLogin() {
  $("#login").classList.remove("hidden");
  $("#app").classList.add("hidden");
}

function showApp() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  setupClubDropdown();
  startClock();
  loadReservations();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("#username").value,
        password: $("#password").value,
      }),
    });
    showApp();
  } catch (err) {
    $("#login-error").textContent = err.message;
  }
});

$("#logout-btn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.reload();
});

// ===== 드롭다운 =====
function setupClubDropdown() {
  const clubSel = $("#club");
  clubSel.innerHTML = Object.keys(GOLF_CLUBS)
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
  clubSel.addEventListener("change", fillCourseDropdown);
  fillCourseDropdown();
}

function fillCourseDropdown() {
  const club = $("#club").value;
  const courses = GOLF_CLUBS[club] || [];
  $("#course").innerHTML = courses
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

// ===== 추가 / 입력 초기화 =====
$("#add-btn").addEventListener("click", async () => {
  const body = {
    club: $("#club").value,
    course: $("#course").value,
    play_date: $("#play-date").value,
    play_time: $("#play-time").value,
  };
  if (!body.play_date || !body.play_time) {
    alert("날짜와 시간을 선택하세요.");
    return;
  }
  await api("/api/reservations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  loadReservations();
});

// 삭제 버튼: 입력칸 초기화
$("#clear-btn").addEventListener("click", () => {
  $("#club").selectedIndex = 0;
  fillCourseDropdown();
  $("#play-date").value = "";
  $("#play-time").value = "";
});

// ===== 예약 리스트 =====
async function loadReservations() {
  const rows = await api("/api/reservations");
  const body = $("#res-body");
  body.innerHTML = "";
  $("#empty-row").classList.toggle("hidden", rows.length > 0);

  for (const r of rows) {
    const tr = document.createElement("tr");
    const done = r.status === "예약완료";
    tr.innerHTML = `
      <td class="col-check">
        <input type="checkbox" data-id="${r.id}" ${r.selected ? "checked" : ""} ${done ? "disabled" : ""} />
      </td>
      <td>${r.club}</td>
      <td>${r.course}</td>
      <td>${r.play_date}</td>
      <td>${r.play_time}</td>
      <td><span class="badge ${done ? "done" : "wait"}">${r.status}</span></td>
      <td><button class="del-row" data-id="${r.id}" title="삭제">✕</button></td>
    `;
    body.appendChild(tr);
  }

  // 체크박스 변경
  body.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", async () => {
      await api(`/api/reservations/${cb.dataset.id}/check`, {
        method: "PATCH",
        body: JSON.stringify({ selected: cb.checked }),
      });
    });
  });

  // 행 삭제
  body.querySelectorAll(".del-row").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/reservations/${btn.dataset.id}`, { method: "DELETE" });
      loadReservations();
    });
  });
}

// 전체 선택
$("#check-all").addEventListener("change", async (e) => {
  const checked = e.target.checked;
  const boxes = $("#res-body").querySelectorAll(
    'input[type="checkbox"]:not(:disabled)'
  );
  for (const cb of boxes) {
    cb.checked = checked;
    await api(`/api/reservations/${cb.dataset.id}/check`, {
      method: "PATCH",
      body: JSON.stringify({ selected: checked }),
    });
  }
});

// ===== 시계 (현재 시각 실시간 표시) =====
function startClock() {
  const tick = () => {
    const now = new Date();
    $("#clock").textContent = `${pad2(now.getHours())}:${pad2(
      now.getMinutes()
    )}:${pad2(now.getSeconds())}`;
  };
  tick();
  setInterval(tick, 250);
}

// ===== 예약 시작 (지정 시각에 자동 실행) =====
let countdownTimer = null;

$("#start-btn").addEventListener("click", () => {
  const h = Number($("#start-h").value);
  const m = Number($("#start-m").value);
  const s = Number($("#start-s").value);
  if (
    $("#start-h").value === "" ||
    $("#start-m").value === "" ||
    $("#start-s").value === ""
  ) {
    alert("예약 시작 시각(시·분·초)을 입력하세요.");
    return;
  }

  setRunning(true);
  $("#status-msg").textContent = `⏳ ${pad2(h)}:${pad2(m)}:${pad2(
    s
  )} 에 예약을 자동 실행합니다...`;

  // 0.25초마다 현재 시각이 목표 시각에 도달했는지 확인
  countdownTimer = setInterval(() => {
    const now = new Date();
    if (
      now.getHours() === h &&
      now.getMinutes() === m &&
      now.getSeconds() === s
    ) {
      clearInterval(countdownTimer);
      runSubmit();
    }
  }, 250);
});

$("#stop-btn").addEventListener("click", () => {
  clearInterval(countdownTimer);
  setRunning(false);
  $("#status-msg").textContent = "중지되었습니다.";
});

async function runSubmit() {
  try {
    const r = await api("/api/reservations/submit", { method: "POST" });
    $("#status-msg").textContent = `✅ 예약 완료! (${r.count}건 처리)`;
    loadReservations();
  } catch (err) {
    $("#status-msg").textContent = "❌ " + err.message;
  } finally {
    setRunning(false);
  }
}

function setRunning(running) {
  $("#start-btn").classList.toggle("hidden", running);
  $("#stop-btn").classList.toggle("hidden", !running);
}

init();
