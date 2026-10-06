// ===== Main script: theme toggle and scroll animations =====

const root = document.documentElement;
const themeButton = document.getElementById("theme-toggle");

// Load the saved theme (if the user chose one before)
const savedTheme = localStorage.getItem("theme");
if (savedTheme) root.setAttribute("data-theme", savedTheme);

// Switch between light and dark when the button is clicked
themeButton.addEventListener("click", () => {
  const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", nextTheme);
  localStorage.setItem("theme", nextTheme);
});

// Show elements with the "reveal" class when they enter the screen
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));