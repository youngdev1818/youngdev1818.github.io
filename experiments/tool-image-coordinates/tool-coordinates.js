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
