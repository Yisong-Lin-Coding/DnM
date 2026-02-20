export function michelangeloEngine({ layers, state, prevState, frame }) {
  const renderFrame =
    frame && typeof frame === "object"
      ? {
          ...frame,
          state: frame.state || state || {},
          prevState: frame.prevState || prevState || null,
        }
      : {
          state: state || {},
          prevState: prevState || null,
        };

  if (!renderFrame.cache || typeof renderFrame.cache !== "object") {
    renderFrame.cache = {};
  }

  for (const layer of Array.isArray(layers) ? layers : []) {
    if (!layer || typeof layer.draw !== "function") continue;

    const shouldRedraw =
      typeof layer.shouldRedraw === "function"
        ? layer.shouldRedraw(renderFrame.state, renderFrame.prevState, renderFrame)
        : true;

    if (!shouldRedraw) continue;
    layer.draw(layer.ctx, layer.canvas, renderFrame.state, renderFrame);
  }
}
