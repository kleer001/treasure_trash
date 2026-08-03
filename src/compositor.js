// Compositor — ordered draw passes over one canvas.
//
// Layer contract:
//   { name: string, draw(ctx, frame): void, enabled?: boolean }
//
// draw() receives the 2D context and a plain `frame` data object (dims, seed, tick —
// whatever the game threads through). Each layer is wrapped in save()/restore() so one
// layer's canvas state cannot bleed into the next.

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

/** The layers that will draw, in order. Split out so ordering is testable without a canvas. */
export function activeLayers(layers) {
  return layers.filter((layer) => layer.enabled !== false);
}

function assertLayer(layer) {
  if (!layer || typeof layer.name !== 'string' || typeof layer.draw !== 'function') {
    throw new Error('a layer must be { name: string, draw(ctx, frame) }');
  }
}
