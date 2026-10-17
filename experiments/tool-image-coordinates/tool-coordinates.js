const imageInput = document.querySelector("#image-file");
const imagePreview = document.querySelector("#image-preview");
const imageStage = document.querySelector("#image-stage");
const imageDetails = document.querySelector("#image-details")

let imageURL = null;

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    imageDetails.textContent = "Please select an image.";
    return;
  }

  // Releases the previous temporary URL
  if (imageURL) {URL.revokeObjectURL(imageURL)}

  // Creates a temporary browser URL
  imageURL = URL.createObjectURL(file);

  // Wait until the image loads
  imagePreview.onload = () => {
    imageStage.hidden = false;

    imageDetails.textContent = 
      `${file.name} — ` +
      `${imagePreview.naturalWidth} x ` +
      `${imagePreview.naturalHeight} pixels`;
  };

  imagePreview.onerror = () => {
    imageStage.hidden = true;
    imageDetails.textContent = "Unable to display this image.";
  };

  // Load the image
  imagePreview.src = imageURL;
});

const coordinateResult = document.querySelector("#coordinate-result");

imagePreview.addEventListener("pointerdown", (event) => {

  // Find the image's possition and display size
  const rect = imagePreview.getBoundingClientRect();

  // Find the touch possition relative to the image
  const displayX = event.clientX - rect.left;
  const displayY = event.clientY - rect.top;

  // Convert to original image coordinates
  const x = Math.round(displayX * (imagePreview.naturalWidth / rect.width));
  const y = Math.round(displayY * (imagePreview.naturalHeight / rect.height));

  // Display the result
  coordinateResult.textContent = `X: ${x}, Y: ${y}`;
});
