import { useState } from 'react';
import type { EquipSlot, ItemInstance } from '../data/items';
import { GOLD_NAME } from '../data/economy';
import { RARITY_INFO } from '../data/rarity';
import type { InventoryView } from '../game/Game';
import { EquipmentSlots, StatList } from './EquipmentPanel';
import { itemIconUrl } from './itemIcons';
import { ItemTooltip } from './ItemTooltip';

export interface InventoryActions {
  onEquip: (index: number) => void;
  onUnequip: (slot: EquipSlot) => void;
  onDrop: (index: number) => void;
  onClose: () => void;
}

interface Hover {
  item: ItemInstance;
  equipped: boolean;
  x: number;
  y: number;
}

/**
 * The backpack window: equipment slots + stats on the left, a fixed 6x5 grid on the right.
 * Left-click equips, right-click drops. Hovering shows the item and how it compares with what is worn.
 * Only this panel handles the clicks; they never reach the game canvas.
 */
export function Inventory({ view, gold, onEquip, onUnequip, onDrop, onClose }: InventoryActions & { view: InventoryView; gold: number }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const used = view.slots.filter(Boolean).length;

  const onHover = (item: ItemInstance, equipped: boolean, e: React.MouseEvent) =>
    setHover({ item, equipped, x: e.clientX, y: e.clientY });
  const onLeave = () => setHover(null);

  return (
    <div className="panel inventory" role="dialog" aria-label="背包" onContextMenu={(e) => e.preventDefault()}>
      <div className="inventory-header">
        <strong>背包</strong>
        <span className="muted">
          {used} / {view.slots.length}
        </span>
        <span className="inventory-gold">
          {GOLD_NAME} <strong>{gold}</strong>
        </span>
        <button type="button" className="close" onClick={onClose} aria-label="關閉背包">
          ✕
        </button>
      </div>
      <div className="inventory-body">
        <div className="inventory-left">
          <EquipmentSlots
            equipment={view.equipment}
            onUnequip={(slot) => {
              setHover(null);
              onUnequip(slot);
            }}
            onHover={onHover}
            onLeave={onLeave}
          />
          <StatList stats={view.stats} />
        </div>
        <div className="grid">
          {view.slots.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`cell ${item ? `r-${item.rarity}` : 'empty'}`}
              style={item ? { borderColor: RARITY_INFO[item.rarity].color } : undefined}
              onClick={() => {
                if (!item) return;
                setHover(null);
                onEquip(i);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!item) return;
                setHover(null);
                onDrop(i);
              }}
              onMouseEnter={(e) => item && onHover(item, false, e)}
              onMouseMove={(e) => item && onHover(item, false, e)}
              onMouseLeave={onLeave}
              aria-label={item ? item.name : '空格'}
            >
              {item && <img src={itemIconUrl(item.slot)} alt="" />}
            </button>
          ))}
        </div>
      </div>
      <div className="inventory-footer muted">I / B 開關背包 · 左鍵 裝備 · 右鍵 丟棄 · 滿包時物品會留在地上</div>
      {hover && (
        <div
          className="tooltip-anchor"
          style={{
            left: hover.x + (hover.x > window.innerWidth / 2 ? -16 : 16),
            top: hover.y + 16,
            transform: hover.x > window.innerWidth / 2 ? 'translateX(-100%)' : undefined,
          }}
        >
          <ItemTooltip item={hover.item} equipment={view.equipment} equipped={hover.equipped} level={view.level} />
        </div>
      )}
    </div>
  );
}
