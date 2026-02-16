export function michelangeloEngine({ layers, state, prevState }) {
  for (const layer of layers) {
    if (!layer.shouldRedraw || layer.shouldRedraw(state, prevState)) {
      layer.draw(layer.ctx, layer.canvas, state);
    }
  }
}
