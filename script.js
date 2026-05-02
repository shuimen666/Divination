const STORAGE_KEY = "divination-history-v1";
const TOTAL_TOSSES = 6;
const COIN_ANIMATION_MS = 1320;
const COIN_STAGGER_MS = 80;
const COIN_SPIN_START = 0.03;
const COIN_SPIN_END = 0.97;

const state = {
  question: "",
  tosses: [],
  currentEntry: null,
  isCasting: false,
  animationFrameId: null
};

const screens = {
  home: document.getElementById("homeScreen"),
  casting: document.getElementById("castingScreen"),
  result: document.getElementById("resultScreen")
};

const elements = {
  questionForm: document.getElementById("questionForm"),
  questionInput: document.getElementById("questionInput"),
  activeQuestion: document.getElementById("activeQuestion"),
  roundLabel: document.getElementById("roundLabel"),
  coinViewport: document.getElementById("coinViewport"),
  coinCamera: document.getElementById("coinCamera"),
  castButton: document.getElementById("castButton"),
  restartButton: document.getElementById("restartButton"),
  tossGrid: document.getElementById("tossGrid"),
  primaryHexagram: document.getElementById("primaryHexagram"),
  changedHexagram: document.getElementById("changedHexagram"),
  primaryName: document.getElementById("primaryName"),
  changedName: document.getElementById("changedName"),
  resultTokens: document.getElementById("resultTokens"),
  resultQuestion: document.getElementById("resultQuestion"),
  resultQuestionCard: document.getElementById("resultQuestionCard"),
  newReadingButton: document.getElementById("newReadingButton"),
  viewQuestionButton: document.getElementById("viewQuestionButton"),
  historyFab: document.getElementById("historyFab"),
  historyModal: document.getElementById("historyModal"),
  historyList: document.getElementById("historyList"),
  closeHistoryButton: document.getElementById("closeHistoryButton"),
  historyItemTemplate: document.getElementById("historyItemTemplate")
};

const coins = Array.from(document.querySelectorAll(".coin"));

initialize();

function initialize() {
  seedCoinRestState();
  renderTossGrid([]);
  bindEvents();
  renderHistory();
}

function bindEvents() {
  elements.questionForm.addEventListener("submit", handleQuestionSubmit);
  elements.castButton.addEventListener("click", handleCast);
  elements.restartButton.addEventListener("click", resetToHome);
  elements.newReadingButton.addEventListener("click", resetToHome);
  elements.viewQuestionButton.addEventListener("click", toggleQuestionCard);
  elements.historyFab.addEventListener("click", openHistory);
  elements.closeHistoryButton.addEventListener("click", closeHistory);

  elements.historyModal.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeHistory === "true") {
      closeHistory();
    }
  });
}

function handleQuestionSubmit(event) {
  event.preventDefault();

  const question = elements.questionInput.value.trim();

  if (!question) {
    elements.questionInput.focus();
    return;
  }

  state.question = question;
  state.tosses = [];
  state.currentEntry = null;
  state.isCasting = false;

  elements.activeQuestion.textContent = question;
  elements.resultQuestion.textContent = question;
  elements.resultQuestionCard.hidden = false;
  elements.questionInput.value = question;

  renderTossGrid(state.tosses);
  updateRoundLabel();
  resetCoinsToNeutral();
  showScreen("casting");
}

async function handleCast() {
  if (state.isCasting || state.tosses.length >= TOTAL_TOSSES) {
    return;
  }

  state.isCasting = true;
  elements.castButton.disabled = true;
  elements.castButton.textContent = "投掷中...";

  const results = generateCoinFaces();
  animateCoins(results);

  await wait(COIN_ANIMATION_MS + COIN_STAGGER_MS * (coins.length - 1));

  const count = results.filter(Boolean).length;
  state.tosses.push(count);
  renderTossGrid(state.tosses);
  updateRoundLabel();

  state.isCasting = false;

  if (state.tosses.length === TOTAL_TOSSES) {
    finalizeReading();
    return;
  }

  elements.castButton.disabled = false;
  elements.castButton.textContent = "开始";
}

function finalizeReading() {
  const primaryBits = state.tosses.map((value) => (value === 1 || value === 3 ? 1 : 0));
  const changedBits = state.tosses.map((value) => (value === 0 || value === 1 ? 1 : 0));
  const entry = {
    id: `reading-${Date.now()}`,
    question: state.question,
    tosses: [...state.tosses],
    createdAt: new Date().toISOString(),
    primaryKey: bitsToKey(primaryBits),
    changedKey: bitsToKey(changedBits)
  };

  state.currentEntry = entry;
  saveHistory(entry);
  renderResult(entry);
  renderHistory();
  elements.castButton.disabled = false;
  elements.castButton.textContent = "开始";
  showScreen("result");
}

function renderResult(entry) {
  const primaryBits = entry.primaryKey.split("").map(Number);
  const changedBits = entry.changedKey.split("").map(Number);

  elements.resultQuestion.textContent = entry.question;
  renderHexagram(elements.primaryHexagram, primaryBits);
  renderHexagram(elements.changedHexagram, changedBits);
  renderResultTokens(entry.tosses);
  elements.primaryName.textContent = getHexagramName(entry.primaryKey);
  elements.changedName.textContent = getHexagramName(entry.changedKey);
  elements.resultQuestionCard.hidden = false;
}

function renderHexagram(container, bits) {
  container.innerHTML = "";

  bits
    .slice()
    .reverse()
    .forEach((bit) => {
      const line = document.createElement("div");
      line.className = `hexagram-line ${bit === 1 ? "hexagram-line--yang" : "hexagram-line--yin"}`;

      if (bit === 1) {
        const segment = document.createElement("span");
        segment.className = "hexagram-line__segment";
        line.appendChild(segment);
      } else {
        const left = document.createElement("span");
        const right = document.createElement("span");
        left.className = "hexagram-line__segment";
        right.className = "hexagram-line__segment";
        line.append(left, right);
      }

      container.appendChild(line);
    });
}

function renderTossGrid(tosses) {
  elements.tossGrid.innerHTML = "";

  for (let index = 0; index < TOTAL_TOSSES; index += 1) {
    const token = document.createElement("div");
    const value = tosses[index];
    const isEmpty = value === undefined;
    token.className = `toss-token ${isEmpty ? "toss-token--empty" : ""}`;

    token.innerHTML = `
      <span class="toss-token__index">第 ${index + 1} 次</span>
      <span class="toss-token__value">${isEmpty ? "—" : value}</span>
      <span class="toss-token__detail">${isEmpty ? "待投掷" : describeToss(value)}</span>
    `;

    elements.tossGrid.appendChild(token);
  }
}

function renderResultTokens(tosses) {
  elements.resultTokens.innerHTML = "";

  tosses.forEach((value, index) => {
    const token = document.createElement("div");
    token.className = "toss-token";
    token.innerHTML = `
      <span class="toss-token__index">第 ${index + 1} 次</span>
      <span class="toss-token__value">${value}</span>
      <span class="toss-token__detail">${describeToss(value)}</span>
    `;
    elements.resultTokens.appendChild(token);
  });
}

function renderHistory() {
  const history = loadHistory();
  elements.historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "还没有历史记录。完成一次起卦后，这里会按时间从近到远保存。";
    elements.historyList.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const fragment = elements.historyItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".history-item");
    const time = fragment.querySelector(".history-item__time");
    const question = fragment.querySelector(".history-item__question");
    const button = fragment.querySelector(".history-item__view");

    time.textContent = formatDate(entry.createdAt);
    question.textContent = entry.question;
    button.addEventListener("click", () => {
      state.question = entry.question;
      state.tosses = [...entry.tosses];
      state.currentEntry = entry;
      renderResult(entry);
      closeHistory();
      showScreen("result");
    });

    item.dataset.entryId = entry.id;
    elements.historyList.appendChild(fragment);
  });
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("screen--active", key === name);
  });
}

function resetToHome() {
  state.question = "";
  state.tosses = [];
  state.currentEntry = null;
  state.isCasting = false;

  elements.questionInput.value = "";
  elements.activeQuestion.textContent = "";
  elements.roundLabel.textContent = "第一次开始";
  elements.castButton.disabled = false;
  elements.castButton.textContent = "开始";
  renderTossGrid([]);
  resetCoinsToNeutral();
  showScreen("home");
}

function updateRoundLabel() {
  const round = state.tosses.length + 1;

  if (state.tosses.length >= TOTAL_TOSSES) {
    elements.roundLabel.textContent = "六次投掷完成";
    return;
  }

  elements.roundLabel.textContent = `第${toChineseNumber(round)}次开始`;
}

function animateCoins(results) {
  stopCastAnimation();

  const plans = coins.map((coin, index) => {
    const isYang = results[index];
    const startRotation = Number(coin.dataset.rotation || 0);
    const finalRotation = isYang ? 0 : 180;
    const driftX = randomBetween(-12, 12);
    const lift = randomBetween(270, 345);
    const arcZ = randomBetween(180, 240);
    return {
      coin,
      startRotation,
      finalRotation,
      targetRotation: getForwardRotationTarget(startRotation, finalRotation),
      driftX,
      lift,
      arcZ,
      bankZ: randomBetween(6, 12),
      settleBank: getRestZ(index),
      tiltPeak: randomBetween(-84, -70),
      startDelay: index * COIN_STAGGER_MS
    };
  });

  const startedAt = performance.now();
  const totalDuration = COIN_ANIMATION_MS + COIN_STAGGER_MS * (plans.length - 1);

  const tick = (now) => {
    const elapsed = now - startedAt;
    const globalT = clamp(elapsed / totalDuration, 0, 1);
    applyCameraFrame(globalT);

    plans.forEach((plan) => {
      const localT = clamp((elapsed - plan.startDelay) / COIN_ANIMATION_MS, 0, 1);
      applyCoinFrame(plan, localT);

      if (localT === 1) {
        plan.coin.dataset.rotation = String(plan.finalRotation);
      }
    });

    if (elapsed < totalDuration) {
      state.animationFrameId = window.requestAnimationFrame(tick);
      return;
    }

    applyCameraFrame(1);
    plans.forEach((plan) => {
      applyCoinRest(plan.coin, plan.finalRotation, plan.settleBank);
      plan.coin.dataset.rotation = String(plan.finalRotation);
    });
    state.animationFrameId = null;
  };

  state.animationFrameId = window.requestAnimationFrame(tick);
}

function resetCoinsToNeutral() {
  stopCastAnimation();
  applyCameraRest();

  coins.forEach((coin, index) => {
    applyCoinRest(coin, 0, getRestZ(index));
    coin.dataset.rotation = "0";
  });
}

function generateCoinFaces() {
  return Array.from({ length: 3 }, () => Math.random() >= 0.5);
}

function bitsToKey(bits) {
  return bits.join("");
}

function getHexagramName(key) {
  const map = window.HEXAGRAM_NAMES || {};
  return map[key] || `待命名 ${key}`;
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function openHistory() {
  renderHistory();
  elements.historyModal.classList.add("is-open");
  elements.historyModal.setAttribute("aria-hidden", "false");
}

function closeHistory() {
  elements.historyModal.classList.remove("is-open");
  elements.historyModal.setAttribute("aria-hidden", "true");
}

function toggleQuestionCard() {
  elements.resultQuestionCard.hidden = !elements.resultQuestionCard.hidden;
}

function describeToss(value) {
  switch (value) {
    case 0:
      return "三阴面";
    case 1:
      return "一阳二阴";
    case 2:
      return "二阳一阴";
    case 3:
      return "三阳面";
    default:
      return "";
  }
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toChineseNumber(value) {
  const map = ["零", "一", "二", "三", "四", "五", "六"];
  return map[value] || String(value);
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function stopCastAnimation() {
  if (state.animationFrameId !== null) {
    window.cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

function seedCoinRestState() {
  resetCoinsToNeutral();
}

function getRestZ(index) {
  const rotations = [-7, 5, -4];
  return rotations[index] ?? 0;
}

function applyCameraRest() {
  elements.coinViewport.style.setProperty("--camera-origin-y", "14%");
  elements.coinCamera.style.setProperty("--camera-tilt", "0deg");
  elements.coinCamera.style.setProperty("--camera-y", "0px");
  elements.coinCamera.style.setProperty("--camera-scale", "1");
}

function applyCameraFrame(progress) {
  const rise = Math.sin(Math.PI * progress);
  const tilt = 58 * Math.pow(rise, 1.05);
  const travel = -52 * Math.pow(rise, 1.2);
  const scale = 1 + 0.055 * rise;
  const origin = 14 + 46 * rise;

  elements.coinViewport.style.setProperty("--camera-origin-y", `${origin}%`);
  elements.coinCamera.style.setProperty("--camera-tilt", `${tilt}deg`);
  elements.coinCamera.style.setProperty("--camera-y", `${travel}px`);
  elements.coinCamera.style.setProperty("--camera-scale", scale.toFixed(4));
}

function applyCoinRest(coin, rotationY, bankZ) {
  coin.style.setProperty("--coin-x", "0px");
  coin.style.setProperty("--coin-y", "0px");
  coin.style.setProperty("--coin-z", "0px");
  coin.style.setProperty("--coin-tilt-x", "0deg");
  coin.style.setProperty("--coin-rotation", `${rotationY}deg`);
  coin.style.setProperty("--coin-bank", `${bankZ}deg`);
}

function applyCoinFrame(plan, progress) {
  if (progress <= 0) {
    applyCoinRest(plan.coin, plan.startRotation, plan.settleBank);
    return;
  }

  const arc = Math.sin(Math.PI * progress);
  const drift = Math.sin(Math.PI * progress);
  const spinWindow = clamp((progress - COIN_SPIN_START) / (COIN_SPIN_END - COIN_SPIN_START), 0, 1);
  const spin = easeInOutCubic(spinWindow);
  const bankFade = 1 - progress;
  const rotation = mix(plan.startRotation, plan.targetRotation, spin);
  const tiltX = plan.tiltPeak * Math.pow(arc, 1.05);
  const bank = mix(plan.bankZ, plan.settleBank, progress) + plan.bankZ * bankFade * 0.25;
  const x = plan.driftX * drift;
  const y = -plan.lift * Math.pow(arc, 0.9);
  const z = plan.arcZ * Math.pow(arc, 1.15);

  plan.coin.style.setProperty("--coin-x", `${x.toFixed(2)}px`);
  plan.coin.style.setProperty("--coin-y", `${y.toFixed(2)}px`);
  plan.coin.style.setProperty("--coin-z", `${z.toFixed(2)}px`);
  plan.coin.style.setProperty("--coin-tilt-x", `${tiltX.toFixed(2)}deg`);
  plan.coin.style.setProperty("--coin-rotation", `${rotation.toFixed(2)}deg`);
  plan.coin.style.setProperty("--coin-bank", `${bank.toFixed(2)}deg`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function getForwardRotationTarget(startRotation, finalRotation) {
  const forwardDelta = ((finalRotation - startRotation) % 360 + 360) % 360;
  return startRotation + 360 + forwardDelta;
}

function randomBetween(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}
