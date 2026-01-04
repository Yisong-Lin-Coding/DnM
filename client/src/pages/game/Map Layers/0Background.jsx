export const backgroundLayer = {
  id: "background",

  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    const c = state.camera;
    const p = prevState.camera;

    // Redraw if image changes or camera moves/zooms
    return (
      state.bgImage !== prevState.bgImage ||
      c.x !== p.x ||
      c.y !== p.y ||
      c.zoom !== p.zoom
    );
  },

  draw(ctx, canvas, state) {

    console.log("background")
    const { bgImage, camera } = state;

    // Skip if no image or canvas
    if (!bgImage || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate aspect ratios
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = bgImage.width / bgImage.height;

    let drawWidth, drawHeight, offsetX, offsetY;

    // Cover the entire canvas while maintaining aspect ratio
    if (canvasRatio > imgRatio) {
      // Canvas is wider → scale by width
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      // Canvas is taller → scale by height
      drawHeight = canvas.height;
      drawWidth = canvas.height * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    }

    // Draw the background image centered and scaled
    ctx.drawImage(bgImage, offsetX, offsetY, drawWidth, drawHeight);
  },
};