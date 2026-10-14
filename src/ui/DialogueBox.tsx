import { useEffect, useState } from 'react';
import { assetUrl } from '../game/AssetLoader';
import type { DialogueSnapshot } from '../game/Game';

export interface DialogueActions {
  onAdvance: () => void;
  onChoose: (index: number) => void;
  onTopic: (index: number) => void;
  onClose: () => void;
}

/**
 * The conversation screen. The NPC's upper body stands at the left; beside it a panel shows what they say.
 * With an NPC the panel first opens as a menu (a greeting and the topics on offer, quest ones marked), and a topic plays out
 * line by line before returning to the menu. Click or Enter / Space continues; 1-9 picks a choice or a topic; Esc leaves.
 */
export function DialogueBox({ dialogue, onAdvance, onChoose, onTopic, onClose }: { dialogue: DialogueSnapshot } & DialogueActions) {
  const { choices, topics, portrait } = dialogue;
  const [portraitFailed, setPortraitFailed] = useState(false);
  useEffect(() => setPortraitFailed(false), [portrait]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const list = topics ?? choices;
      if (list) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= list.length) {
          e.preventDefault();
          if (topics) onTopic(n - 1);
          else onChoose(n - 1);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, topics, onAdvance, onChoose, onTopic]);

  const showPortrait = portrait !== null && !portraitFailed;

  return (
    <div className="dialogue-layer" onContextMenu={(e) => e.preventDefault()}>
      {showPortrait && (
        <img className="dialogue-portrait" src={assetUrl(portrait)} alt="" draggable={false} onError={() => setPortraitFailed(true)} />
      )}
      <div className={`panel dialogue-box${showPortrait ? ' with-portrait' : ''}`} onClick={choices || topics ? undefined : onAdvance}>
        <div className="dialogue-head">
          <span className="dialogue-speaker">{dialogue.speaker}</span>
          {dialogue.title && dialogue.speaker === dialogue.npcName && <span className="dialogue-title">{dialogue.title}</span>}
        </div>
        <div className="dialogue-text">{dialogue.text}</div>
        {topics ? (
          <>
            <div className="dialogue-choices">
              {topics.map((t, i) => (
                <button
                  key={`${i}-${t.label}`}
                  type="button"
                  className={`dialogue-choice topic-${t.kind}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTopic(i);
                  }}
                >
                  <span className="dialogue-choice-key">{i + 1}</span>
                  <span className={`topic-mark topic-mark-${t.kind}`}>{t.mark}</span>
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                className="dialogue-choice dialogue-leave"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                <span className="dialogue-choice-key">Esc</span>
                離開
              </button>
            </div>
          </>
        ) : choices ? (
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
    </div>
  );
}
