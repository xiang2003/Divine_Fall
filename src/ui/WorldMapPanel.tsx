import type { WorldGraphView } from '../systems/worldGraph';

/**
 * The world map (M): every map as a box, a line for each connection. The box you stand in is gold; maps you have not
 * visited are dim; a dashed line with a lock is a road that is not open yet.
 */
export function WorldMapPanel({ graph, onClose }: { graph: WorldGraphView | null; onClose: () => void }) {
  const byId = new Map(graph?.nodes.map((n) => [n.id, n]) ?? []);
  return (
    <div className="panel world-map" onContextMenu={(e) => e.preventDefault()}>
      <div className="world-map-head">
        <strong>地圖</strong>
        <button type="button" onClick={onClose}>
          關閉（M）
        </button>
      </div>
      {!graph ? (
        <p className="muted">載入中…</p>
      ) : (
        <div className="world-map-board">
          <svg className="world-map-lines" aria-hidden="true">
            {graph.edges.map((e) => {
              const a = byId.get(e.a);
              const b = byId.get(e.b);
              if (!a || !b) return null;
              return (
                <line
                  key={`${e.a}|${e.b}`}
                  x1={`${a.x}%`}
                  y1={`${a.y}%`}
                  x2={`${b.x}%`}
                  y2={`${b.y}%`}
                  className={e.locked ? 'edge locked' : 'edge'}
                />
              );
            })}
          </svg>
          {graph.edges
            .filter((e) => e.locked)
            .map((e) => {
              const a = byId.get(e.a);
              const b = byId.get(e.b);
              if (!a || !b) return null;
              return (
                <div key={`lock-${e.a}|${e.b}`} className="world-map-lock" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }} title={e.hint ?? ''}>
                  🔒 尚未開通
                </div>
              );
            })}
          {graph.nodes.map((n) => (
            <div
              key={n.id}
              className={`world-map-node${n.current ? ' current' : ''}${n.visited ? '' : ' unvisited'}`}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <div className="world-map-name">{n.name}</div>
              <div className="world-map-kind">{n.current ? '◆ 你在這裡' : n.visited ? n.kind : `${n.kind} · 尚未去過`}</div>
            </div>
          ))}
        </div>
      )}
      <div className="world-map-legend muted">◆ 目前位置　·　暗色：尚未去過　·　虛線與鎖：尚未開通的路　·　M 或 Esc 關閉</div>
    </div>
  );
}
