import type { ItemInstance } from '../data/items';
import { describeItem, diffRows } from '../systems/itemText';
import { statsIfEquipped, type Equipment } from '../systems/stats';

interface Props {
  item: ItemInstance;
  equipment: Readonly<Equipment>;
  /** True when the item being hovered is itself currently worn. */
  equipped: boolean;
  /** Character level, so the comparison uses the same stats as combat. */
  level: number;
}

/** Item description, plus a "if you wear this" comparison against whatever is in the same slot. */
export function ItemTooltip({ item, equipment, equipped, level }: Props) {
  const d = describeItem(item);
  const worn = equipment[item.slot];
  const rows = !equipped ? diffRows(...diffArgs(equipment, item, level)) : [];

  return (
    <div className="tooltip" style={{ borderColor: d.color }}>
      <div className="tooltip-name" style={{ color: d.color }}>
        {d.name}
      </div>
      <div className="tooltip-sub">
        {d.rarityLabel} · {d.slotLabel}
        {d.name !== d.baseName && ` · ${d.baseName}`}
      </div>
      {d.base.map((l) => (
        <div key={l} className="tooltip-base">
          {l}
        </div>
      ))}
      {d.affixes.map((l) => (
        <div key={l} className="tooltip-affix">
          {l}
        </div>
      ))}
      {d.effect && <div className="tooltip-effect">{d.effect}</div>}
      {d.lore && <div className="tooltip-lore">{d.lore}</div>}

      {equipped ? (
        <div className="tooltip-hint">已裝備 · 點擊卸下</div>
      ) : (
        <div className="tooltip-compare">
          <div className="tooltip-compare-title">
            {worn ? `與裝備中的「${worn.name}」比較` : `該部位尚未裝備，裝備後：`}
          </div>
          {rows.length === 0 && <div className="muted">屬性沒有變化</div>}
          {rows.map((r) => {
            const up = r.after > r.before;
            return (
              <div key={r.key} className={up ? 'delta-up' : 'delta-down'}>
                {r.label} {r.format(r.before)} → {r.format(r.after)} {up ? '▲' : '▼'}
              </div>
            );
          })}
          <div className="tooltip-hint">左鍵：裝備　右鍵：丟棄</div>
        </div>
      )}
    </div>
  );
}

function diffArgs(equipment: Readonly<Equipment>, item: ItemInstance, level: number) {
  const { before, after } = statsIfEquipped(equipment, item, level);
  return [before, after] as const;
}
