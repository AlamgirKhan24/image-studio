// ===== Finder page: search, show results, download =====

const form = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const orientationSelect = document.getElementById("orientation-select");
const colorSelect = document.getElementById("color-select");
const gallery = document.getElementById("gallery");
const message = document.getElementById("message");
const loadMoreButton = document.getElementById("load-more");

// Wikimedia cannot filter by color, so we turn that menu off
// Some sources cannot filter by color, so we turn that menu off
if (!providerSupportsColor()) {
  colorSelect.disabled = true;
  colorSelect.title = "Color filter is not available for this source";
}

// Remember the last search so "Load more" can continue it
let currentSearch = { query: "", orientation: "", color: "" };
let currentPage = 1;

// ---------- Small helpers ----------

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
}

// Gray placeholder cards while images are loading
function showSkeletons(count = 8) {
  gallery.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton";
    gallery.appendChild(skeleton);
  }
}

function removeSkeletons() {
  gallery.querySelectorAll(".skeleton").forEach((item) => item.remove());
}

// Build one image card
function createImageCard(photo) {
  const card = document.createElement("article");
  card.className = "image-card glass";

  card.innerHTML = `
    <img loading="lazy" />
    <div class="image-card__overlay">
      <p class="image-card__author"></p>
      <div class="image-card__actions">
        <a class="btn" target="_blank" rel="noopener">View</a>
        <button class="btn btn--primary" type="button">Download</button>
      </div>
    </div>
  `;

  // Fill the values with JavaScript (safer than putting API text inside HTML)
  const image = card.querySelector("img");
  image.src = photo.imageUrl;
  image.alt = photo.alt;

    // Show the author, and the license when the source gives one
  const licenseText = photo.license ? ` · ${photo.license}` : "";
  card.querySelector(".image-card__author").textContent = `📷 ${photo.author}${licenseText}`;
  card.querySelector("a").href = photo.pageUrl;

  const downloadButton = card.querySelector("button");
  downloadButton.addEventListener("click", () => downloadImage(photo, downloadButton));

  return card;
}

// Download an image file to the device
async function downloadImage(photo, button) {
  const originalText = button.textContent;
  button.textContent = "Saving...";

  try {
    const response = await fetch(photo.downloadUrl);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `image-studio-${photo.id}.jpg`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    // If the browser blocks the download, open the image in a new tab instead
    window.open(photo.downloadUrl, "_blank");
  }

  button.textContent = originalText;
}

// ---------- Main search logic ----------

async function runSearch(isNewSearch) {
  hideMessage();

  if (isNewSearch) {
    currentPage = 1;
    showSkeletons();
    loadMoreButton.hidden = true;
  } else {
    currentPage += 1;
    loadMoreButton.textContent = "Loading...";
  }

  try {
    const { photos, hasMore } = await searchImages({ ...currentSearch, page: currentPage });

    if (isNewSearch) removeSkeletons();

    if (photos.length === 0 && isNewSearch) {
      showMessage("No images found. Try a different word.");
      return;
    }

    photos.forEach((photo) => gallery.appendChild(createImageCard(photo)));
    loadMoreButton.hidden = !hasMore;
  } catch (error) {
    removeSkeletons();
    showMessage(error.message);
  } finally {
    loadMoreButton.textContent = "Load more";
  }
}

// ---------- Events ----------

form.addEventListener("submit", (event) => {
  event.preventDefault();

  currentSearch = {
    query: searchInput.value.trim(),
    orientation: orientationSelect.value,
    color: colorSelect.value,
  };

  runSearch(true);
});

loadMoreButton.addEventListener("click", () => runSearch(false));

// Curated shortcuts on the Finder page use the same search flow as the form.
document.querySelectorAll("[data-search]").forEach((card) => {
  card.addEventListener("click", () => {
    searchInput.value = card.dataset.search;
    currentSearch = {
      query: searchInput.value,
      orientation: orientationSelect.value,
      color: colorSelect.value,
    };
    runSearch(true);
    gallery.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
