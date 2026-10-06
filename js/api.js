// ===== API: every request to an image service lives in this file =====
//
// Image search sources:
//   - Openverse (default, needs NO key)
//   - Pixabay   (needs a free key)
//   - Pexels    (needs a free key)
//
// Every source returns the same simple shape, so the pages stay clean:
// { id, imageUrl, downloadUrl, pageUrl, author, alt, license }

const OPENVERSE_SEARCH_URL = "https://api.openverse.org/v1/images/";
const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const PIXABAY_SEARCH_URL = "https://pixabay.com/api/";
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

// ---------- Openverse (no key needed) ----------

// Openverse uses its own words for orientation
const OPENVERSE_ASPECT = { landscape: "wide", portrait: "tall", square: "square" };

// Without an account, Openverse allows 20 images per page and about 12 pages
const OPENVERSE_MAX_PER_PAGE = 20;
const OPENVERSE_MAX_PAGES = 12;

/**
 * Turn the license code from Openverse into a readable label.
 * Examples: "by" + "2.0" -> "CC BY 2.0", "cc0" -> "CC0", "pdm" -> "Public Domain"
 */
function formatLicense(license, version) {
  if (!license) return "";

  const code = license.toLowerCase();
  if (code === "cc0") return "CC0";
  if (code === "pdm") return "Public Domain";

  const versionText = version ? ` ${version}` : "";
  return `CC ${code.toUpperCase()}${versionText}`;
}

async function searchOpenverse({ query, orientation, page, perPage }) {
  const params = new URLSearchParams({
    q: query,
    category: "photograph",
    page,
    page_size: Math.min(perPage, OPENVERSE_MAX_PER_PAGE),
  });

  if (OPENVERSE_ASPECT[orientation]) {
    params.append("aspect_ratio", OPENVERSE_ASPECT[orientation]);
  }

  const response = await fetch(`${OPENVERSE_SEARCH_URL}?${params}`);

  checkResponse(response);
  const data = await response.json();

  return {
    hasMore: data.page < Math.min(data.page_count, OPENVERSE_MAX_PAGES),
    photos: data.results.map((item) => ({
      id: `openverse-${item.id}`,
      imageUrl: item.thumbnail || item.url,
      downloadUrl: item.url,
      pageUrl: item.foreign_landing_url,
      author: item.creator || "Unknown author",
      alt: item.title || "Image from Openverse",
      license: formatLicense(item.license, item.license_version),
    })),
  };
}

// ---------- Pexels (needs a key) ----------

async function searchPexels({ query, orientation, color, page, perPage }) {
  const params = new URLSearchParams({ query, page, per_page: perPage });

  // Only add the filters the user actually chose
  if (orientation) params.append("orientation", orientation);
  if (color) params.append("color", color);

  const response = await fetch(`${PEXELS_SEARCH_URL}?${params}`, {
    headers: { Authorization: CONFIG.PEXELS_API_KEY },
  });

  checkResponse(response);
  const data = await response.json();

  return {
    hasMore: Boolean(data.next_page),
    photos: data.photos.map((photo) => ({
      id: `pexels-${photo.id}`,
      imageUrl: photo.src.medium,
      downloadUrl: photo.src.large2x,
      pageUrl: photo.url,
      author: photo.photographer,
      alt: photo.alt || `Photo by ${photo.photographer}`,
      license: "",
    })),
  };
}

// ---------- Pixabay (needs a key) ----------

// Pixabay uses different words for orientation and one color name
const PIXABAY_ORIENTATION = { landscape: "horizontal", portrait: "vertical" };
const PIXABAY_COLOR = { violet: "lilac" };

async function searchPixabay({ query, orientation, color, page, perPage }) {
  const params = new URLSearchParams({
    key: CONFIG.PIXABAY_API_KEY,
    q: query,
    image_type: "photo",
    safesearch: "true",
    page,
    per_page: perPage,
  });

  // Pixabay has no "square" option, so we skip it
  if (PIXABAY_ORIENTATION[orientation]) {
    params.append("orientation", PIXABAY_ORIENTATION[orientation]);
  }
  if (color) params.append("colors", PIXABAY_COLOR[color] || color);

  const response = await fetch(`${PIXABAY_SEARCH_URL}?${params}`);

  checkResponse(response);
  const data = await response.json();

  return {
    hasMore: page * perPage < data.totalHits,
    photos: data.hits.map((hit) => ({
      id: `pixabay-${hit.id}`,
      imageUrl: hit.webformatURL,
      downloadUrl: hit.largeImageURL,
      pageUrl: hit.pageURL,
      author: hit.user,
      alt: hit.tags,
      license: "",
    })),
  };
}

// ---------- Shared helpers ----------

// Turn bad responses into clear messages for the user
function checkResponse(response) {
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new Error("The request was refused. Check your settings or try a different search.");
  }
  if (response.status === 429) {
    throw new Error("Daily or hourly limit reached. Please wait a while and try again.");
  }
  if (!response.ok) {
    throw new Error("Something went wrong. Please try again.");
  }
}

/**
 * Which image source is active?
 * If there is no config.js file, we use Openverse (it needs no key).
 */
function getImageProvider() {
  const hasConfig = typeof CONFIG !== "undefined" && CONFIG.IMAGE_PROVIDER;
  return hasConfig ? CONFIG.IMAGE_PROVIDER : "openverse";
}

// Only Pexels and Pixabay can filter by color
function providerSupportsColor() {
  const provider = getImageProvider();
  return provider === "pexels" || provider === "pixabay";
}

/**
 * The only search function the pages need.
 * It uses the source chosen in config.js (IMAGE_PROVIDER).
 */
async function searchImages({ query, orientation = "", color = "", page = 1, perPage = 24 }) {
  const options = { query, orientation, color, page, perPage };
  const provider = getImageProvider();

  if (provider === "pexels") return searchPexels(options);
  if (provider === "pixabay") return searchPixabay(options);
  return searchOpenverse(options);
}

// ---------- Image generation (Pollinations, no key needed) ----------

/**
 * Build the link that creates an image from a text prompt.
 * The image is made when the browser opens this link.
 */
function buildGeneratedImageUrl({ prompt, width, height }) {
  const seed = Math.floor(Math.random() * 1000000); // different image each time
  const params = new URLSearchParams({ width, height, seed, nologo: "true", model: "flux" });
  return `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?${params}`;
}