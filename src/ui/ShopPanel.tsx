import { useState } from 'react';
import { GOLD_NAME } from '../data/economy';
import type { EquipSlot, ItemInstance } from '../data/items';
import { RARITY_INFO, rarityRank } from '../data/rarity';
import type { InventoryView, ShopView } from '../game/Game';
import { sellPrice } from '../systems/economy';
import { itemIconUrl } from './itemIcons';
import { ItemTooltip } from './ItemTooltip';

export interface ShopActions {
  onBuy: (slot: EquipSlot) => void;
  onSell: (index: number) => void;
  onLeave: () => void;
}

interface Hover {
  item: ItemInstance;
  x: number;
  y: number;
  /** What it sells for; absent for the piece just bought. */
  price?: number;
}

/** Selling anything from this rarity up asks for a second click, so a good find is not given away by accident. */
const CONFIRM_FROM = rarityRank('rare');

/**
 * The merchant's window, shown in place of the conversation text: on the left the categories of equipment on sale (the price is fixed, the rarity
 * of what comes out is drawn at random), on the right the backpack to sell from (the merchant pays only a fraction of an item's worth).
 */
export function ShopPanel({
  speaker,
  title,
  shop,
  gold,
  inventory,
  onBuy,
  onSell,
  onLeave,
}: ShopActions & { speaker: string; title: string | null; shop: ShopView; gold: number; inventory: InventoryView }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const bagFull = inventory.slots.every(Boolean);

  const onHover = (item: ItemInstance, e: React.MouseEvent, price?: number) => setHover({ item, x: e.clientX, y: e.clientY, price });
  const onLeaveHover = () => setHover(null);

  return (
    <div className="panel dialogue-box shop with-portrait" onContextMenu={(e) => e.preventDefault()}>
      <div className="dialogue-head">
        <span className="dialogue-speaker">{speaker}</span>
        {title && <span className="dialogue-title">{title}</span>}
        <span className="shop-gold" title={GOLD_NAME}>
          {GOLD_NAME} <strong>{gold}</strong>
        </span>
      </div>
      <div className="shop-body">
        <div className="shop-buy">
          <div className="shop-heading">購買（選類別，稀有度隨機）</div>
          {shop.offers.map((o) => {
            const affordable = gold >= o.price;
            return (
              <button
                key={o.slot}
                type="button"
                className="shop-offer"
                disabled={!affordable || bagFull}
                onClick={() => {
                  setHover(null);
                  setConfirm(null);
                  onBuy(o.slot);
                }}
                title={!affordable ? `${GOLD_NAME}不夠` : bagFull ? '背包已滿' : `花 ${o.price} ${GOLD_NAME}抽一件${o.label}`}
              >
                <img src={itemIconUrl(o.slot)} alt="" />
                <span className="shop-offer-label">{o.label}</span>
                <span className={affordable ? 'shop-price' : 'shop-price short'}>{o.price}</span>
              </button>
            );
          })}
          <div className="shop-last">
            {shop.last ? (
              <>
                買到了：
                <span
                  className="shop-last-name"
                  style={{ color: RARITY_INFO[shop.last.rarity].color }}
                  onMouseEnter={(e) => onHover(shop.last!, e)}
                  onMouseMove={(e) => onHover(shop.last!, e)}
                  onMouseLeave={onLeaveHover}
                >
                  [{RARITY_INFO[shop.last.rarity].label}] {shop.last.name}
                </span>
              </>
            ) : (
              <span className="muted">普通最常見，運氣好才抽得到稀有與傳奇。</span>
            )}
          </div>
          {bagFull && <div className="shop-warn">背包已滿，買不了。</div>}
        </div>
        <div className="shop-sell">
          <div className="shop-heading">出售背包裡的裝備（只收兩成價）</div>
          <div className="grid shop-grid">
            {inventory.slots.map((item, i) => {
              const price = item ? sellPrice(item) : 0;
              const needsConfirm = item ? rarityRank(item.rarity) >= CONFIRM_FROM : false;
              const asking = confirm === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={`cell ${item ? `r-${item.rarity}` : 'empty'}${asking ? ' asking' : ''}`}
                  style={item ? { borderColor: asking ? '#ff5a4a' : RARITY_INFO[item.rarity].color } : undefined}
                  onClick={() => {
                    if (!item) return;
                    if (needsConfirm && !asking) {
                      setConfirm(i);
                      return;
                    }
                    setHover(null);
                    setConfirm(null);
                    onSell(i);
                  }}
                  onMouseEnter={(e) => item && onHover(item, e, price)}
                  onMouseMove={(e) => item && onHover(item, e, price)}
                  onMouseLeave={() => {
                    onLeaveHover();
                    setConfirm((c) => (c === i ? null : c));
                  }}
                  aria-label={item ? `${item.name}，賣 ${price} ${GOLD_NAME}` : '空格'}
                >
                  {item && <img src={itemIconUrl(item.slot)} alt="" />}
                  {item && <span className={asking ? 'cell-price asking' : 'cell-price'}>{asking ? '確定？' : price}</span>}
                </button>
              );
            })}
          </div>
          <div className="shop-note muted">左鍵賣出（稀有以上要再點一次）。穿在身上的要先卸下。</div>
        </div>
      </div>
      <div className="dialogue-choices">
        <button
          type="button"
          className="dialogue-choice dialogue-leave"
          onClick={(e) => {
            e.stopPropagation();
            onLeave();
          }}
        >
          <span className="dialogue-choice-key">←</span>
          回到談話
        </button>
      </div>
      {hover && (
        <div
          className="tooltip-anchor"
          style={{
            left: hover.x + (hover.x > window.innerWidth / 2 ? -16 : 16),
            top: hover.y + 16,
            transform: hover.x > window.innerWidth / 2 ? 'translateX(-100%)' : undefined,
          }}
        >
          <ItemTooltip
            item={hover.item}
            equipment={inventory.equipment}
            equipped={false}
            level={inventory.level}
            hint={hover.price !== undefined ? `左鍵：賣出，得 ${hover.price} ${GOLD_NAME}` : '已放進背包'}
          />
        </div>
      )}
    </div>
  );
}
