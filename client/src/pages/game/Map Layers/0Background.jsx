export const backgroundLayer = {
  id: "background",

  shouldRedraw(state, prevState) {
    const c = state?.camera;
    const p = prevState?.camera;
    if (!c || !p) return true;

    // Redraw if image changes or camera moves/zooms
    return (
      state.backgroundKey !== prevState.backgroundKey ||
      state.bgImage !== prevState.bgImage ||
      c.x !== p.x ||
      c.y !== p.y ||
      c.zoom !== p.zoom
    );
  },

  draw(ctx, canvas, state) {
    const { bgImage, camera, backgroundKey } = state;

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!bgImage) {
      const key = String(backgroundKey || "").trim().toLowerCase();
      if (!key || key === "gray" || key === "grey") {
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

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
