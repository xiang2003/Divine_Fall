import { useEffect, useRef } from 'react';
import { MINIMAP_SIZE } from './minimapSize';
import { drawMinimap, renderMapLayer, type MapLayer, type MinimapView } from './minimapDraw';

/**
 * The round minimap at the top right. It reads the live positions straight from the game every frame (they change faster than
 * the React snapshot is published) and redraws a small canvas; the map picture itself is only rebuilt when the map changes.
 */
export function Minimap({ getView, title }: { getView: () => MinimapView | null; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = MINIMAP_SIZE * ratio;
    canvas.height = MINIMAP_SIZE * ratio;
    let layer: MapLayer | null = null;
    let layerMap: unknown = null;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const view = getView();
      if (!view) return;
      if (layerMap !== view.map) {
        layer = renderMapLayer(view.map);
        layerMap = view.map;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (layer) drawMinimap(ctx, MINIMAP_SIZE, layer, view);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getView]);

  return (
    <div className="minimap" title={title}>
      <canvas ref={canvasRef} className="minimap-canvas" style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }} />
    </div>
  );
}
