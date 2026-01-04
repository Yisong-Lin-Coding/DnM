export const mapObjectsLayer = {
  id: "mapObjects",

  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    
    // Redraw if camera moved or objects changed
    const c = state.camera;
    const p = prevState.camera;
    
    return (
      c.x !== p.x ||
      c.y !== p.y ||
      c.zoom !== p.zoom ||
      JSON.stringify(state.mapObjects) !== JSON.stringify(prevState.mapObjects)
    );
  },

  draw(ctx, canvas, state) {
    const { camera, mapObjects = [] } = state;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sort by Z-index (lower Z renders first, behind higher Z)
    const sorted = [...mapObjects].sort((a, b) => a.z - b.z);
    
    for (const obj of sorted) {
      // Convert world coordinates to screen coordinates
      const screenX = obj.x * camera.zoom - camera.x;
      const screenY = obj.y * camera.zoom - camera.y;
      
      ctx.fillStyle = obj.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      
      if (obj.type === 'circle') {
        const radius = obj.size * camera.zoom;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } 
      else if (obj.type === 'rect') {
        const width = obj.width * camera.zoom;
        const height = obj.height * camera.zoom;
        ctx.fillRect(screenX - width / 2, screenY - height / 2, width, height);
        ctx.strokeRect(screenX - width / 2, screenY - height / 2, width, height);
      } 
      else if (obj.type === 'triangle') {
        const size = obj.size * camera.zoom;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - size);
        ctx.lineTo(screenX - size, screenY + size);
        ctx.lineTo(screenX + size, screenY + size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      
      // Draw Z-index label
      ctx.fillStyle = '#ffffff';
      ctx.font = `${12 * camera.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`Z:${obj.z}`, screenX, screenY + (obj.size || 20) * camera.zoom + 15);
    }
  },
};