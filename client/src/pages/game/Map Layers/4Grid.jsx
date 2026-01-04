const GRID_SIZE = 50;

export const gridlayer = {
  id: "grid",

  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    const c = state.camera;
    const p = prevState.camera;

    return c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom;
  },

  draw(ctx, canvas, state) {
    const { camera } = state;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#7F807E";
    ctx.lineWidth = 1;

    // Calculate world bounds that are currently visible on screen
    const worldLeft = camera.x / camera.zoom;
    const worldTop = camera.y / camera.zoom;
    const worldRight = (camera.x + canvas.width) / camera.zoom;
    const worldBottom = (camera.y + canvas.height) / camera.zoom;

    // Find the first grid line to draw (snap to grid in world space)
    const startWorldX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
    const endWorldX = Math.ceil(worldRight / GRID_SIZE) * GRID_SIZE;
    const startWorldY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
    const endWorldY = Math.ceil(worldBottom / GRID_SIZE) * GRID_SIZE;

    // Draw vertical lines
    for (let worldX = startWorldX; worldX <= endWorldX; worldX += GRID_SIZE) {
      const screenX = worldX * camera.zoom - camera.x;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let worldY = startWorldY; worldY <= endWorldY; worldY += GRID_SIZE) {
      const screenY = worldY * camera.zoom - camera.y;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvas.width, screenY);
      ctx.stroke();
    }
  },
};