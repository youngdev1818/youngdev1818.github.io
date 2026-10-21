# Young Dev Image Mapper

This tool is entirely client-side. Open `index.html` via your Young Dev site or any static web server. No images are uploaded.

## How to use

1. Choose an image. Tap/click to place the starting A–D corners of the selected polygon. Drag any displayed corner to adjust it, or edit its coordinate fields.
2. **Add Point** arms a one-time click/tap for vertices E–Z. It can also be used before D. **Remove Last Point** and the per-row minus buttons let a polygon shrink to two vertices. A two-point shape is an open line; three or more vertices create a polygon.
3. In **Polygons**, choose the active layer. All visible polygons are drawn together. Checkboxes hide/show layers, and the small X deletes a layer. Click **+ Add Polygon** to start another.
4. Switch **SVG px** / **CSS %** without changing the original image coordinates. Copy the selected polygon's output, or **Copy SVG Overlay** for all visible polygons and their fills.
5. Change **Color A**, opacity, and optionally **Use linear gradient**, **Color B**, and angle for the active polygon.
6. **Undo Last Edit** reverses the latest point addition/deletion, drag, coordinate edit, polygon change, or fill edit. One drag is one undo step. Zoom/pan are view navigation, not undoable geometry changes.
7. The tool autosaves the current image, layers, gradients, and view into IndexedDB within the browser and site origin. Reopening the page normally restores it. Browser storage can be cleared or evicted, so use **Save Project JSON** for a portable backup. **Open Project JSON** restores that file, including its image.
8. **Save View PNG** exports the visible image workspace at the current zoom/pan, with the drawn polygons, numbers, markers, gradients, and grid. It does *not* export the surrounding controls. When you need an unclipped full-image overlay, use **Copy SVG Overlay**.

## Design notes

- All polygon vertices are stored in the image's intrinsic pixel coordinates. Percentage conversion occurs only in the editor/export.
- Gradients belong to polygons, not to the background image. The layer uses SVG gradients in the live canvas; the PNG export reproduces them in a canvas.
- IndexedDB is best-effort, not permanent storage. Data stays on this device and in this browser profile. Use the JSON file when switching devices, browsers, or origins.
- The undo stack is capped at 100 edits and does not persist after the tab is closed, even though the project itself autosaves.
- Point selection is available by direct manipulation or choosing a layer in the right panel. On touch, a one-finger swipe pans (unless locked) and a two-finger gesture pans/zooms.
