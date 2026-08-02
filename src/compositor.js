// Ordered draw passes over one canvas. A layer is { name, draw(ctx, frame), enabled? }.

/**
 * Create an ordered layer compositor.
 * @param {Array<{name: string, draw: Function, enabled?: boolean}>} [layers]
 * @returns {{add: Function, layers: Function, render: Function}}
 */
export function createCompositor(layers = []) {
  const stack = [];
  const api = {
    add(layer) {
      assertLayer(layer);
      stack.push(layer);
      return api;
    },
    layers() {
      return stack.slice();
    },
    /** Draw every enabled layer in order, each inside its own save/restore. */
    render(ctx, frame = {}) {
      if (!ctx || typeof ctx.save !== 'function' || typeof ctx.restore !== 'function') {
        throw new Error('compositor.render() requires a 2D canvas context');
      }
      for (const layer of activeLayers(stack)) {
        ctx.save();
        layer.draw(ctx, frame);
        ctx.restore();
      }
    },
  };
  layers.forEach(api.add);
  return api;
}

/** The layers that will actually draw, in order. Pure, so ordering is testable. */
export function activeLayers(layers) {
  return layers.filter((layer) => layer.enabled !== false);
}

function assertLayer(layer) {
  if (!layer || typeof layer.name !== 'string' || typeof layer.draw !== 'function') {
    throw new Error('a layer must be { name: string, draw(ctx, frame) }');
  }
}
