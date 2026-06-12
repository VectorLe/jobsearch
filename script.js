const content = document.querySelector(".content");
const minimizeBtn = document.querySelector(".minimizeBtn");
const maximizeBtn = document.querySelector(".maximizeBtn");

const setDetailsOpen = (open) => {
  content?.querySelectorAll("details").forEach((details) => {
    details.open = open;
  });
};

minimizeBtn?.addEventListener("click", () => setDetailsOpen(false));
maximizeBtn?.addEventListener("click", () => setDetailsOpen(true));
