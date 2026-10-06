// ===== Generator page: send the prompt, show the image, download =====

const generatorForm = document.getElementById("generator-form");
const promptInput = document.getElementById("prompt-input");
const styleSelect = document.getElementById("style-select");
const sizeSelect = document.getElementById("size-select");
const generateButton = document.getElementById("generate-button");
const resultArea = document.getElementById("result-area");

const surpriseButton = document.getElementById("surprise-button");
const copyButton = document.getElementById("copy-button");
const historySection = document.getElementById("history");
const historyList = document.getElementById("history-list");
const clearHistoryButton = document.getElementById("clear-history");

// Extra words added to the prompt for each style
const STYLE_HINTS = {
  none: "",
  realistic: ", realistic photo, natural light, high detail",
  anime: ", anime style, vibrant colors",
  "digital-art": ", digital art, highly detailed",
  "oil-painting": ", oil painting, visible brush strokes",
  "3d": ", 3D render, soft lighting",
};

// Ideas for the "Surprise me" button
const SURPRISE_IDEAS = [
  "A cozy cabin in a snowy forest at night, warm light in the windows",
  "A robot gardener watering flowers on a rooftop at sunrise",
  "A floating island with a waterfall above the clouds",
  "A tiny astronaut sitting on a giant mushroom",
  "A busy night market in a futuristic city, glowing lanterns",
  "A lighthouse on a cliff during a stormy sea",
  "A friendly dragon reading a book in a library",
  "A quiet desert road at golden hour with a lone red car",
];

const WAIT_SECONDS = 15;      // the free service needs a short pause between images
const MAX_LOAD_SECONDS = 90;  // stop waiting if the image never arrives
const HISTORY_KEY = "image-studio-history";
const MAX_HISTORY = 8;

// ---------- History (saved in the browser) ----------

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (error) {
    return []; // storage not available, so we just start empty
  }
}

function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch (error) {
    // If saving fails, the app still works, we just do not remember
  }
}

// Fill the form again with an old idea
function useHistoryItem(item) {
  promptInput.value = item.prompt;
  styleSelect.value = item.style;
  sizeSelect.value = item.size;
  promptInput.focus();
}

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";
  historySection.hidden = items.length === 0;

  items.forEach((item) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = item.prompt;
    chip.title = item.prompt;
    chip.addEventListener("click", () => useHistoryItem(item));
    historyList.appendChild(chip);
  });
}

function addToHistory(newItem) {
  // Remove the same idea if it is already saved, then put it first
  const items = loadHistory().filter(
    (item) =>
      !(item.prompt === newItem.prompt &&
        item.style === newItem.style &&
        item.size === newItem.size)
  );

  items.unshift(newItem);
  saveHistory(items.slice(0, MAX_HISTORY));
  renderHistory();
}

// ---------- Helpers: what the result area shows ----------

function showLoading() {
  resultArea.innerHTML = `
    <div class="loader" aria-label="Loading"></div>
    <p class="result__placeholder">Creating your image... this can take a few seconds.</p>
  `;
}

function showError(text) {
  resultArea.innerHTML = `<p class="result__error"></p>`;
  resultArea.querySelector(".result__error").textContent = text;
}

function showImage(image) {
  resultArea.innerHTML = "";
  image.className = "result__image";
  image.alt = "Generated image";

  const downloadButton = document.createElement("button");
  downloadButton.className = "btn btn--primary";
  downloadButton.type = "button";
  downloadButton.textContent = "Download";
  downloadButton.addEventListener("click", () => downloadGeneratedImage(image.src, downloadButton));

  resultArea.append(image, downloadButton);
}

// Load the image in the background and tell us when it is ready
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => reject(new Error("This is taking too long. Please try again.")),
      MAX_LOAD_SECONDS * 1000
    );

    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("The image service is busy or not available. Please try again in a moment."));
    };
    image.src = url;
  });
}

// Save the image to the device
async function downloadGeneratedImage(url, button) {
  const originalText = button.textContent;
  button.textContent = "Saving...";

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `image-studio-${Date.now()}.jpg`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    // If the browser blocks the download, open the image in a new tab instead
    window.open(url, "_blank");
  }

  button.textContent = originalText;
}

// Disable the button for a few seconds so the service is not overloaded
function startCooldown() {
  let secondsLeft = WAIT_SECONDS;
  generateButton.disabled = true;
  generateButton.textContent = `Wait ${secondsLeft}s`;

  const timer = setInterval(() => {
    secondsLeft -= 1;
    generateButton.textContent = `Wait ${secondsLeft}s`;

    if (secondsLeft <= 0) {
      clearInterval(timer);
      generateButton.disabled = false;
      generateButton.textContent = "Generate";
    }
  }, 1000);
}

// ---------- Main logic ----------

generatorForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const idea = promptInput.value.trim();
  if (!idea) return;

  const [width, height] = sizeSelect.value.split("x");
  const fullPrompt = idea + STYLE_HINTS[styleSelect.value];

  startCooldown();
  showLoading();

  try {
    const url = buildGeneratedImageUrl({ prompt: fullPrompt, width, height });
    const image = await loadImage(url);
    showImage(image);

    // Remember this idea only when the image was made successfully
    addToHistory({ prompt: idea, style: styleSelect.value, size: sizeSelect.value });
  } catch (error) {
    showError(error.message);
  }
});

// ---------- Extra buttons ----------

// Put a random idea in the box
surpriseButton.addEventListener("click", () => {
  const randomIndex = Math.floor(Math.random() * SURPRISE_IDEAS.length);
  promptInput.value = SURPRISE_IDEAS[randomIndex];
});

// Curated starting points make it easy to begin with a polished idea.
document.querySelectorAll("[data-prompt]").forEach((card) => {
  card.addEventListener("click", () => {
    promptInput.value = card.dataset.prompt;
    styleSelect.value = card.dataset.style || "none";
    promptInput.focus();
    generatorForm.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

// Copy the idea to the clipboard
copyButton.addEventListener("click", async () => {
  const text = promptInput.value.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "✅ Copied!";
  } catch (error) {
    copyButton.textContent = "Could not copy";
  }

  setTimeout(() => { copyButton.textContent = "📋 Copy prompt"; }, 1500);
});

// Delete all saved ideas
clearHistoryButton.addEventListener("click", () => {
  saveHistory([]);
  renderHistory();
});

// Show the saved ideas when the page opens
renderHistory();
