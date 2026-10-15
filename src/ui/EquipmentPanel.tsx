import { GOLD_NAME } from '../data/economy';
import { EQUIP_SLOTS, SLOT_LABEL, type EquipSlot, type ItemInstance } from '../data/items';
import { RARITY_INFO } from '../data/rarity';
import { STAT_ROWS } from '../systems/itemText';
import type { PlayerStats } from '../systems/stats';
import type { Equipment } from '../systems/stats';
import { itemIconUrl } from './itemIcons';

export type HoverHandlers = {
  onHover: (item: ItemInstance, equipped: boolean, e: React.MouseEvent) => void;
  onLeave: () => void;
};

interface SlotsProps extends HoverHandlers {
  equipment: Readonly<Equipment>;
  onUnequip: (slot: EquipSlot) => void;
}

/** The five equipment slots inside the inventory window. Click a worn item to take it off. */
export function EquipmentSlots({ equipment, onUnequip, onHover, onLeave }: SlotsProps) {
  return (
    <div className="equip-slots">
      {EQUIP_SLOTS.map((slot) => {
        const item = equipment[slot];
        return (
          <button
            key={slot}
            type="button"
            className={`cell equip-cell ${item ? `r-${item.rarity}` : 'empty'}`}
            style={item ? { borderColor: RARITY_INFO[item.rarity].color } : undefined}
            onClick={() => item && onUnequip(slot)}
            onMouseEnter={(e) => item && onHover(item, true, e)}
            onMouseMove={(e) => item && onHover(item, true, e)}
            onMouseLeave={onLeave}
            aria-label={`${SLOT_LABEL[slot]}${item ? `：${item.name}` : '（空）'}`}
          >
            {item ? <img src={itemIconUrl(slot)} alt="" /> : <span className="slot-label">{SLOT_LABEL[slot]}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Derived character stats (the numbers combat actually uses). */
export function StatList({ stats }: { stats: Readonly<PlayerStats> }) {
  return (
    <div className="stat-list">
      {STAT_ROWS.filter((r) => !r.extra || r.get(stats as PlayerStats) !== 0).map((r) => (
        <div key={r.key} className="stat-row">
          <span>{r.label}</span>
          <span>{r.format(r.get(stats as PlayerStats))}</span>
        </div>
      ))}
    </div>
  );
}

/** Compact "what am I wearing" list shown on the HUD. */
export function EquipmentSummary({ equipment, gold }: { equipment: Readonly<Equipment>; gold: number }) {
  return (
    <div className="panel hud-equipment">
      {EQUIP_SLOTS.map((slot) => {
        const item = equipment[slot];
        return (
          <div key={slot} className="summary-row">
            <span className="summary-slot">{SLOT_LABEL[slot]}</span>
            {item ? (
              <span style={{ color: RARITY_INFO[item.rarity].color }}>{item.name}</span>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
        );
      })}
      <div className="summary-row summary-gold">
        <span className="summary-slot">{GOLD_NAME}</span>
        <span>{gold}</span>
      </div>
    </div>
  );
}
