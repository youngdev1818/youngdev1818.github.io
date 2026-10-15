const slides = [
  {
    src: "Gallery/Portal/Evo-Gensss/dev-gensss1.jpg",
    caption: "Original Assembly"
  },
  {
    src: "Gallery/Portal/Evo-Gensss/dev-gensss2.jpg",
    caption: "Phase 2"
  },
  {
    src: "Gallery/Portal/Evo-Gensss/dev-gensss3.jpg",
    caption: "Phase 3"
  },
  {
    src: "Gallery/Portal/Evo-Gensss/dev-gensss4.jpg",
    caption: "Phase 4"
  },
  {
    src: "Gallery/Portal/Evo-Gensss/dev-gensss5.jpg",
    caption: "Phase 5"
  },
  {
    src: "Gallery/Portal/Evo-Gensss/dev-gensss6.jpg",
    caption: "Phase 6"
  }
];

const lightbox = document.getElementById("temple-lightbox");
const image = document.getElementById("lightbox-image");
const caption = document.getElementById("lightbox-caption");
const dots = document.getElementById("lightbox-dots");
const card = document.querySelector(".slideshow").closest(".gallery-card");

let currentSlide = 0;

/* Display selected image */
function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;

  image.src = slides[currentSlide].src;
  image.alt = slides[currentSlide].caption;
  caption.textContent = slides[currentSlide].caption;

  dots.querySelectorAll("button").forEach((dot, i) => {
    dot.classList.toggle("active", i === currentSlide);
    dot.setAttribute("aria-current", i === currentSlide ? "true" : "false");
  });
}

/* Generate navigation dots */
slides.forEach((slide, index) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.setAttribute("aria-label", "View" + slide.caption);
  dot.addEventListener("click", () => {showSlide(index)});
  dots.appendChild(dot);
});

/* Open popup */
card.addEventListener("click", () => {
  showSlide(0);
  lightbox.showModal();
});

/* Previous image */
document.querySelector(".lightbox-prev")
  .addEventListener("click", () => {
    showSlide(currentSlide - 1);
  });

/* Next image */
document.querySelector(".lightbox-next")
  .addEventListener("click", () => {
    showSlide(currentSlide + 1);
  });

/* Close popup */
document.querySelector(".lightbox-close")
  .addEventListener("click", () => {
    lightbox.close();
  });
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {lightbox.close}
});

/* Keyboard navigation */
lightbox.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showSlide(currentSlide - 1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    showSlide(currentSlide + 1);
  }
});
