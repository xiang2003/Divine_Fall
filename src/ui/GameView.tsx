import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from '../game/Game';
import { HUD } from './HUD';

/** Mounts the Three.js game into a div and exposes its state to the HUD. */
export function GameView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const g = new Game(container);
    setGame(g);
    void g.start();
    return () => {
      g.dispose();
      setGame(null);
    };
  }, []);

  return (
    <div className="game-root">
      <div className="game-canvas" ref={containerRef} />
      {game && <HudBridge game={game} />}
    </div>
  );
}

function HudBridge({ game }: { game: Game }) {
  const snapshot = useSyncExternalStore(game.subscribe, game.getSnapshot);
  return <HUD snapshot={snapshot} onRestart={game.restart} />;
}
