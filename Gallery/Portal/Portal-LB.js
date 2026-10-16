/* Reusable Gallery Lightbox */
const lightbox = document.getElementById("temple-lightbox");
const image = document.getElementById("lightbox-image");
const caption = document.getElementById("lightbox-caption");
const dots = document.getElementById("lightbox-dots");
const title = lightbox.querySelector("h2");

let slides = [];
let currentSlide = 0;

/* Display selected image */
function showSlide(index) {
  if (!slides.length) return;
  
  currentSlide = (index + slides.length) % slides.length;

  const slide = slides[currentSlide]

  image.src = slide.src;
  image.alt = slide.alt;
  caption.textContent = slide.caption;

  dots.querySelectorAll("button").forEach((dot, i) => {
    dot.classList.toggle("active", i === currentSlide);
    dot.setAttribute("aria-current", i === currentSlide ? "true" : "false");
  });
}

/* Open any slideshow card */
function openGallery(card) {
  const elements = card.querySelectorAll(".slideshow > div");

  slides = Array.from(elements).map(element => {
    const img = element.querySelector("img");
    const text = element.querySelector(".slide-caption");

    return {
      src: img.src,
      alt: img.alt,
      caption: text?.textContent.trim() || img.alt
    };
  });

  if (!slides.length) return;

  title.textContent =
    card.querySelector("figcaption")?.textContent.trim() || "Artwork Gallery";

  /* Navigation Dots */
  dots.replaceChildren();

  slides.forEach((slide, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", "View" + slide.caption);
    dot.addEventListener("click", () => {showSlide(index)});
    dots.appendChild(dot);
  });

  showSlide(0);
  lightbox.showModal();
}

/* Connect all slideshow cards */
document.querySelectorAll(".lightbox-trigger").forEach(card => {
  card.addEventListener("click", () => openGallery(card));

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGallery(card);
    }
  });
});

/* Previous image */
lightbox.querySelector(".lightbox-prev")
  .addEventListener("click", () => {
    showSlide(currentSlide - 1);
  });

/* Next image */
lightbox.querySelector(".lightbox-next")
  .addEventListener("click", () => {
    showSlide(currentSlide + 1);
  });

/* Close popup */
lightbox.querySelector(".lightbox-close")
  .addEventListener("click", () => {
    lightbox.close();
  });

/* Close when clicking the backdrop*/
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
