export function michelangeloEngine({ layers, state }) {
  for (const layer of layers) {
    if (!layer.shouldRedraw || layer.shouldRedraw(state)) {
      layer.draw(layer.ctx, layer.canvas, state);
    }
  }
}