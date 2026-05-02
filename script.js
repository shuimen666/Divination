const STORAGE_KEY = "divination-history-v1";
const TOTAL_TOSSES = 6;
const FLIP_DURATION_MS = 900;

const state = {
  question: "",
  tosses: [],
  currentEntry: null,
  isCasting: false
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

  await wait(FLIP_DURATION_MS);

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
  coins.forEach((coin, index) => {
    const isYang = results[index];
    coin.classList.remove("is-flipping");
    coin.style.setProperty("--final-rotation", `${isYang ? 0 : 180}deg`);
    void coin.offsetWidth;
    coin.classList.add("is-flipping");
    coin.style.transform = `rotateY(${isYang ? 0 : 180}deg)`;
  });
}

function resetCoinsToNeutral() {
  coins.forEach((coin) => {
    coin.classList.remove("is-flipping");
    coin.style.removeProperty("--final-rotation");
    coin.style.transform = "rotateY(0deg)";
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
