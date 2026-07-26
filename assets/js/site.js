const header = document.querySelector("[data-site-header]");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-navigation");
const navigationLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
const revealElements = [...document.querySelectorAll(".reveal")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const setHeaderState = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
};

const closeMenu = () => {
  if (!menuButton || !navigation) return;

  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  navigation?.classList.toggle("is-open", !isOpen);
});

navigationLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    menuButton?.focus();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 800) closeMenu();
});

if (reducedMotion || !("IntersectionObserver" in window)) {
  revealElements.forEach((element) => element.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.08
    }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
}

const observedSections = navigationLinks
  .map((link) => {
    const target = document.querySelector(link.getAttribute("href"));
    return target ? { link, target } : null;
  })
  .filter(Boolean);

if ("IntersectionObserver" in window && observedSections.length > 0) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visibleEntry) return;

      navigationLinks.forEach((link) => link.removeAttribute("aria-current"));
      const activeItem = observedSections.find(({ target }) => target === visibleEntry.target);
      activeItem?.link.setAttribute("aria-current", "true");
    },
    {
      rootMargin: "-22% 0px -58% 0px",
      threshold: [0.05, 0.2, 0.5]
    }
  );

  observedSections.forEach(({ target }) => sectionObserver.observe(target));
}

const currentYear = String(new Date().getFullYear());
document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = currentYear;
});
