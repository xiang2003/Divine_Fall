import type { ReputationView } from '../systems/reputation';
import type { QuestView } from '../systems/quests';

const STATE_LABEL: Record<QuestView['state'], string> = {
  locked: '未開放',
  available: '可接取',
  active: '進行中',
  ready: '可交付',
  completed: '已完成',
};

function ObjectiveLine({ o }: { o: QuestView['objectives'][number] }) {
  return (
    <li className={`quest-objective${o.done ? ' done' : ''}${o.active ? ' current' : ''}`}>
      <span className="quest-check">{o.done ? '✓' : o.active ? '▸' : '·'}</span>
      {o.label}
      {o.target > 1 && (
        <span className="quest-count">
          {' '}
          {o.current}/{o.target}
        </span>
      )}
    </li>
  );
}

/** Small always-on list of the quests in progress (top left). */
export function QuestTracker({ quests, npcName }: { quests: readonly QuestView[]; npcName: (id: string) => string }) {
  const open = quests.filter((q) => q.state === 'active' || q.state === 'ready').slice(0, 3);
  if (open.length === 0) return null;
  return (
    <div className="panel hud-quests">
      {open.map((q) => (
        <div key={q.id} className="tracker-quest">
          <div className="tracker-title">{q.title}</div>
          {q.state === 'ready' ? (
            <div className="quest-objective current">
              <span className="quest-check">!</span>回報{npcName(q.turnInNpc)}
            </div>
          ) : (
            <ul className="quest-objectives">
              {q.objectives.filter((o) => o.active).map((o) => (
                <ObjectiveLine key={o.label} o={o} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** The quest log (J). */
export function QuestLog({
  quests,
  npcName,
  reputation,
  onClose,
}: {
  quests: readonly QuestView[];
  npcName: (id: string) => string;
  reputation: readonly ReputationView[];
  onClose: () => void;
}) {
  const current = quests.filter((q) => q.state !== 'completed');
  const done = quests.filter((q) => q.state === 'completed');
  return (
    <div className="panel quest-log" onContextMenu={(e) => e.preventDefault()}>
      <div className="quest-log-head">
        <strong>任務</strong>
        <button type="button" onClick={onClose}>
          關閉（J）
        </button>
      </div>
      {quests.length === 0 && <p className="muted">還沒有接任務。和村裡的人聊聊吧。</p>}
      {reputation.some((r) => r.value !== 0) && (
        <div className="reputation">
          <div className="muted">聲望（各方怎麼看你）</div>
          {reputation.map((r) => (
            <div key={r.id} className="reputation-row" title={r.effect}>
              <span>{r.name}</span>
              <span className={`reputation-rank ${r.value > 0 ? 'good' : r.value < 0 ? 'bad' : ''}`}>
                {r.rank}（{r.value > 0 ? '+' : ''}{r.value}）
              </span>
            </div>
          ))}
        </div>
      )}
      {current.map((q) => (
        <div key={q.id} className="quest-entry">
          <div className="quest-title">
            {q.title} <span className={`quest-state ${q.state}`}>{STATE_LABEL[q.state]}</span>
          </div>
          <div className="quest-summary">{q.summary}</div>
          <ul className="quest-objectives">
            {q.objectives.map((o) => (
              <ObjectiveLine key={o.label} o={o} />
            ))}
          </ul>
          {q.state === 'ready' && <div className="quest-return">回報：{npcName(q.turnInNpc)}</div>}
          <div className="quest-rewards">獎勵：{q.rewards}</div>
        </div>
      ))}
      {done.length > 0 && (
        <div className="quest-done">
          <div className="muted">已完成</div>
          {done.map((q) => (
            <div key={q.id} className="quest-done-entry">
              ✓ {q.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
