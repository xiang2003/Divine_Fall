import { useEffect } from 'react';
import type { DialogueSnapshot } from '../game/Game';

export interface DialogueActions {
  onAdvance: () => void;
  onChoose: (index: number) => void;
  onClose: () => void;
}

/** The conversation panel. Click or Enter / Space continues; 1-9 picks a choice; Esc (handled by the game) leaves. */
export function DialogueBox({ dialogue, onAdvance, onChoose }: { dialogue: DialogueSnapshot } & DialogueActions) {
  const { choices } = dialogue;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (choices) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
          e.preventDefault();
          onChoose(n - 1);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, onAdvance, onChoose]);

  return (
    <div
      className="panel dialogue-box"
      onClick={choices ? undefined : onAdvance}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="dialogue-speaker">{dialogue.speaker}</div>
      <div className="dialogue-text">{dialogue.text}</div>
      {choices ? (
        <div className="dialogue-choices">
          {choices.map((text, i) => (
            <button
              key={`${i}-${text}`}
              type="button"
              className="dialogue-choice"
              onClick={(e) => {
                e.stopPropagation();
                onChoose(i);
              }}
            >
              <span className="dialogue-choice-key">{i + 1}</span>
              {text}
            </button>
          ))}
        </div>
      ) : (
        <div className="dialogue-hint">{dialogue.last ? '點擊或按 Enter 結束' : '點擊或按 Enter 繼續'} · Esc 離開</div>
      )}
    </div>
  );
}
