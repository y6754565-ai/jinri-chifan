const $ = (selector) => document.querySelector(selector);
const pickerSection = $("#pickerSection");
const resultsSection = $("#resultsSection");
const modalBackdrop = $("#modalBackdrop");
const appBase = new URL("./", window.location.href);

function assetUrl(value) {
  if (!value || /^(https?:|data:)/.test(value)) return value;
  return new URL(value.replace(/^\/+/, ""), appBase).href;
}

const imageMap = {
  "stir-fry": "/images/cucumber-pork.jpg",
  greens: "/images/greens-pork.jpg",
  cucumber: "/images/smashed-cucumber.jpg",
  soup: "/images/greens-soup.jpg",
  meat: "/images/meat.svg",
  tofu: "/images/tofu.svg",
  egg: "/images/egg.svg",
  noodles: "/images/noodles.svg"
};
const categoryFallbacks = {
  水产: "/images/greens-soup.jpg",
  早餐: "/recipes/chao-hua-dan.jpg",
  甜品: "/recipes/ji-dan-geng.jpg",
  荤菜: "/images/cucumber-pork.jpg",
  汤羹: "/images/greens-soup.jpg",
  主食: "/recipes/xi-hong-shi-mian.jpg",
  素菜: "/images/smashed-cucumber.jpg"
};

let currentRecipes = [];
let installPrompt = null;
let recipePack = [];
const selectedIngredients = new Set();
const preferredIngredients = [
  "鸡蛋", "猪肉", "鸡肉", "牛肉", "排骨", "鱼", "虾", "西红柿", "土豆", "茄子",
  "青椒", "黄瓜", "胡萝卜", "洋葱", "白菜", "青菜", "菠菜", "生菜", "芹菜", "花菜",
  "西兰花", "豆腐", "香菇", "金针菇", "豆芽", "冬瓜", "南瓜", "玉米", "米饭", "面条"
];
const ingredientAliases = {
  番茄: "西红柿", 西红柿: "西红柿", 马铃薯: "土豆", 洋芋: "土豆",
  土豆: "土豆", 马铃薯: "土豆", 茄子: "茄子", 青椒: "青椒", 辣椒: "青椒",
  菠菜: "菠菜", 菜心: "菜心", 娃娃菜: "白菜", 白菜: "白菜",
  花菜: "花菜", 菜花: "花菜", 猪肉: "猪肉", 瘦肉: "猪肉",
  鸡胸肉: "鸡肉", 鸡腿肉: "鸡肉", 皮蛋: "皮蛋", 松花蛋: "皮蛋",
  面条: "面条", 挂面: "面条"
};

async function loadRecipePack() {
  const response = await fetch(assetUrl("recipes.json"));
  recipePack = await response.json();
  const frequency = new Map();
  recipePack.forEach((recipe) => recipe.ingredients.forEach((item) => {
    frequency.set(item, (frequency.get(item) || 0) + 1);
    if (!(item in ingredientAliases)) ingredientAliases[item] = item;
  }));
  const commonIngredients = [
    ...preferredIngredients.filter((item) => frequency.has(item)),
    ...[...frequency].sort((a, b) => b[1] - a[1]).map(([item]) => item)
  ].filter((item, index, list) => list.indexOf(item) === index).slice(0, 32);

  const dishCount = recipePack.filter((recipe) =>
    recipe.imageExact && !["饮品", "调味料", "半成品"].includes(recipe.category)
  ).length;
  $("#recipePackBadge").textContent = `${dishCount} 道菜 · 完全免费`;
  $("#ingredientPicker").innerHTML = commonIngredients
    .map((item) => `<button class="ingredient-choice" data-ingredient="${item}">${item}</button>`).join("");
}

loadRecipePack().catch(() => toast("本地菜谱包加载失败，请刷新页面"));

$("#ingredientPicker").addEventListener("click", (event) => {
  const button = event.target.closest(".ingredient-choice");
  if (!button) return;
  const ingredient = button.dataset.ingredient;
  if (selectedIngredients.has(ingredient)) selectedIngredients.delete(ingredient);
  else selectedIngredients.add(ingredient);
  button.classList.toggle("selected");
  $("#localMatchButton").disabled = selectedIngredients.size === 0;
});

function syncIngredientButtons() {
  document.querySelectorAll(".ingredient-choice").forEach((button) => {
    button.classList.toggle("selected", selectedIngredients.has(button.dataset.ingredient));
  });
  $("#localMatchButton").disabled = selectedIngredients.size === 0;
}

function selectIngredientsFromText(text) {
  let remaining = text.replace(/\s+/g, "");
  const matched = new Set();
  Object.entries(ingredientAliases)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([alias, ingredient]) => {
      if (!remaining.includes(alias)) return;
      matched.add(ingredient);
      remaining = remaining.split(alias).join("");
    });

  if (matched.size === 0) {
    toast("没有识别到菜谱包支持的食材，请再说一次");
    return;
  }

  selectedIngredients.clear();
  matched.forEach((item) => selectedIngredients.add(item));
  syncIngredientButtons();
  $("#voiceHint").textContent = `已识别：${[...matched].join("、")}。可以继续调整或直接匹配。`;
}

let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    $("#voiceButton").classList.add("listening");
    $("#voiceButton span").textContent = "正在听…";
    $("#voiceHint").textContent = "请说出你现有的食材";
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    $("#ingredientTextInput").value = transcript;
    selectIngredientsFromText(transcript);
  };
  recognition.onerror = (event) => {
    const message = event.error === "not-allowed"
      ? "请允许浏览器使用麦克风"
      : "没有听清，请再说一次";
    toast(message);
    $("#voiceHint").textContent = message;
  };
  recognition.onend = () => {
    $("#voiceButton").classList.remove("listening");
    $("#voiceButton span").textContent = "按下说话";
  };
} else {
  $("#voiceButton").disabled = true;
  $("#voiceButton span").textContent = "暂不支持";
  $("#voiceHint").textContent = "当前浏览器不支持网页语音识别，请在输入框输入食材。";
}

$("#voiceButton").addEventListener("click", () => {
  if (!recognition) return;
  if ($("#voiceButton").classList.contains("listening")) recognition.stop();
  else {
    try {
      recognition.start();
    } catch {
      toast("语音识别正在启动，请稍等");
    }
  }
});

let textInputTimer;
$("#ingredientTextInput").addEventListener("input", (event) => {
  clearTimeout(textInputTimer);
  const text = event.target.value.trim();
  if (!text) return;
  textInputTimer = setTimeout(() => selectIngredientsFromText(text), 350);
});

$("#ingredientTextInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  clearTimeout(textInputTimer);
  const text = event.target.value.trim();
  if (!text) return;
  selectIngredientsFromText(text);
  if (selectedIngredients.size > 0) $("#localMatchButton").click();
});

$("#clearIngredients").addEventListener("click", () => {
  selectedIngredients.clear();
  $("#ingredientTextInput").value = "";
  $("#voiceHint").textContent = "说“我有西红柿、鸡蛋和面条”，会自动勾选。";
  syncIngredientButtons();
});

$("#localMatchButton").addEventListener("click", () => {
  const selected = [...selectedIngredients];
  const scored = recipePack.filter((recipe) =>
    recipe.imageExact && !["饮品", "调味料", "半成品"].includes(recipe.category)
  ).map((recipe) => {
    const used = recipe.ingredients.filter((item) => selected.includes(item));
    const missing = recipe.ingredients.filter((item) => !selected.includes(item));
    const selectedCoverage = used.length / selected.length;
    const score = used.length * 120 + selectedCoverage * 60 - Math.min(missing.length, 6) * 9;
    return {
      ...recipe,
      used,
      extras: [...missing, ...recipe.extras],
      match: Math.max(40, Math.min(100, Math.round(65 + selectedCoverage * 35 - Math.min(missing.length, 5) * 4))),
      score
    };
  }).filter((recipe) => recipe.used.length > 0)
    .sort((a, b) => b.score - a.score || a.time - b.time)
    .slice(0, 4);

  if (scored.length === 0) {
    toast("菜谱包里暂时没有这些食材的菜，请换一种搭配");
    return;
  }

  renderResults({
    ingredients: selected,
    summary: scored.length < 4
      ? `只找到 ${scored.length} 道真正相关的菜，没有用无关菜凑数。继续增加食材会有更多组合。`
      : `本地菜谱包已按你选择的 ${selected.length} 种食材完成匹配，全程不调用 AI。`,
    recipes: scored,
    local: true
  });
  pickerSection.hidden = true;
  resultsSection.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
}

function renderResults(data) {
  currentRecipes = data.recipes;
  $("#resultCount").textContent = data.recipes.length;
  $("#resultSummary").textContent = data.summary;
  $("#ingredientList").innerHTML = data.ingredients
    .map((item) => `<span class="ingredient-tag">${escapeHtml(item)}</span>`).join("");
  $("#recipeGrid").innerHTML = data.recipes.map((recipe, index) => `
    <button class="recipe-card" data-index="${index}">
      <img class="recipe-image" src="${assetUrl(recipe.image || imageMap[recipe.imageKey] || imageMap["stir-fry"])}" alt="${escapeHtml(recipe.name)}成品图">
      <div class="recipe-card-body">
        <h3>${escapeHtml(recipe.name)}</h3>
        <p>${escapeHtml(recipe.subtitle)}</p>
        <div class="card-meta">
          <span>${recipe.time} 分钟 · ${escapeHtml(recipe.difficulty)}</span>
          <span class="match">${recipe.match}% 匹配</span>
        </div>
      </div>
    </button>
  `).join("");
  $("#recipeGrid").querySelectorAll(".recipe-image").forEach((image, index) => {
    image.addEventListener("error", () => {
      image.src = assetUrl(categoryFallbacks[data.recipes[index].category] || imageMap["stir-fry"]);
    }, { once: true });
  });
  $("#demoNotice").hidden = true;
}

$("#recipeGrid").addEventListener("click", (event) => {
  const card = event.target.closest(".recipe-card");
  if (!card) return;
  const recipe = currentRecipes[Number(card.dataset.index)];
  $("#modalImage").src = assetUrl(recipe.image || imageMap[recipe.imageKey] || imageMap["stir-fry"]);
  $("#modalImage").alt = `${recipe.name}成品图`;
  $("#modalImage").onerror = () => {
    $("#modalImage").onerror = null;
    $("#modalImage").src = assetUrl(categoryFallbacks[recipe.category] || imageMap["stir-fry"]);
  };
  $("#modalMatch").textContent = `${recipe.match}% 食材匹配`;
  $("#modalTitle").textContent = recipe.name;
  $("#modalSubtitle").textContent = recipe.subtitle;
  $("#modalMeta").innerHTML = `<span>⏱ ${recipe.time} 分钟</span><span>难度 · ${escapeHtml(recipe.difficulty)}</span>`;
  $("#modalIngredients").innerHTML = [
    ...recipe.used.map((item) => `<span>${escapeHtml(item)}</span>`),
    ...recipe.extras.map((item) => `<span class="extra">${escapeHtml(item)}</span>`)
  ].join("");
  $("#modalSteps").innerHTML = recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
});

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
}
$("#modalClose").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

$("#resetButton").addEventListener("click", () => {
  resultsSection.hidden = true;
  pickerSection.hidden = false;
  currentRecipes = [];
  selectedIngredients.clear();
  $("#ingredientTextInput").value = "";
  $("#voiceHint").textContent = "说“我有西红柿、鸡蛋和面条”，会自动勾选。";
  syncIngredientButtons();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
});

$("#installButton").addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else {
    toast("iPhone：点 Safari 下方分享按钮，再选“添加到主屏幕”");
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register(assetUrl("sw.js")).catch(() => {}));
}
