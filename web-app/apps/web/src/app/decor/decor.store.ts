import { Injectable, computed, inject, signal } from '@angular/core';
import type { GardenFailure } from '../garden/garden.service';
import {
  ROOM_ROWS,
  TileCoord,
  canPlaceIn,
  decorAnchorFor,
  decorRect,
  decorSpec,
  decorSpots,
  describeItem,
  footprintTiles,
  isThirsty,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import { PlayerStore } from '../habitat/player.store';
import { t } from '../i18n/i18n';

/** Placing a decoration from the inventory, or moving one that's already up. */
export type DecorMode = { kind: 'PLACE'; itemId: string } | { kind: 'MOVE'; itemId: string; decorId: string };

export type DecorOutcome = { ok: true; message: string } | { ok: false; error: GardenFailure };

/** The bar sits at the top when what you're decorating reaches the bottom rows of the room. */
const BAR_FLIP_ROW = ROOM_ROWS - 5;

/**
 * Decorating the station: which decoration is being placed or moved and where it would go, and
 * which placed decoration is selected (its Move / Put away menu). The rules live in @garden/shared.
 */
@Injectable({ providedIn: 'root' })
export class DecorStore {
  private readonly garden = inject(GardenStore);
  private readonly player = inject(PlayerStore);

  readonly mode = signal<DecorMode | null>(null);
  /** Top-left where the decoration would go (the tapped spot), once one is picked. */
  readonly candidate = signal<TileCoord | null>(null);
  /** The placed decoration whose menu is open. */
  private readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.garden.decorations().find((d) => d.id === this.selectedId()) ?? null);

  /** Placing, moving, or a decoration's menu: something decor-related is on screen. */
  readonly active = computed(() => !!this.mode() || !!this.selected());

  /** The decoration on the bar: the one being placed or moved, or the selected one. */
  readonly itemId = computed(() => this.mode()?.itemId ?? this.selected()?.itemId ?? null);
  readonly item = computed(() => {
    const id = this.itemId();
    return id ? describeItem(id) : undefined;
  });
  /** The selected thing can be watered (a potted plant). */
  readonly selectedWaterable = computed(() => {
    const s = this.selected();
    return !!s && !!decorSpec(s.itemId)?.waterable;
  });
  /** The selected potted plant wants water (it shines once watered; it never wilts). */
  readonly selectedThirsty = computed(() => {
    const s = this.selected();
    return !!s && isThirsty(s, this.garden.now());
  });

  /** The decoration being moved (drawn as the preview instead of in its old spot). */
  readonly movingId = computed(() => {
    const mode = this.mode();
    return mode?.kind === 'MOVE' ? mode.decorId : undefined;
  });

  /** Every tile some valid spot would cover, to light up while placing. Null when not placing. */
  readonly spotTiles = computed<TileCoord[] | null>(() => {
    const mode = this.mode();
    if (!mode) return null;
    const { w, h } = decorSpec(mode.itemId)!;
    const seen = new Map<string, TileCoord>();
    for (const at of decorSpots(mode.itemId, this.player.room(), this.garden.decorations(), this.movingId())) {
      for (const t of footprintTiles({ ...at, w, h })) seen.set(`${t.x},${t.y}`, t);
    }
    return [...seen.values()];
  });

  /** Where the decoration would go, for the preview. */
  readonly candidateRect = computed(() => {
    const mode = this.mode();
    const at = this.candidate();
    return mode && at ? decorRect({ itemId: mode.itemId, ...at }) : null;
  });

  /** Outline: the preview while placing, else the selected decoration. */
  readonly focusRect = computed(() => {
    if (this.mode()) return this.candidateRect();
    const s = this.selected();
    return s ? decorRect(s) : null;
  });

  /**
   * Show the bar at the top of the screen instead of the bottom, so it doesn't cover what you're
   * decorating: wall spots are at the top (bar below), floor spots fill the room (bar above, unless
   * the spot you picked is up there). A selected decoration's menu goes on the other half.
   */
  readonly barAtTop = computed(() => {
    const focus = this.focusRect();
    if (focus) return focus.y + focus.h > BAR_FLIP_ROW;
    const mode = this.mode();
    return !!mode && decorSpec(mode.itemId)?.mount === 'FLOOR';
  });

  /** Can `itemId` be placed in the room you're in? (Decorations: the Social Space; pots: anywhere.) */
  canPlaceHere(itemId: string): boolean {
    return canPlaceIn(itemId, this.player.room());
  }

  /** Start placing one `itemId` from the inventory. */
  start(itemId: string): void {
    this.begin({ kind: 'PLACE', itemId });
  }

  /** Start moving the selected decoration. */
  startMove(): void {
    const d = this.selected();
    if (d) this.begin({ kind: 'MOVE', itemId: d.itemId, decorId: d.id });
  }

  /** A tile was tapped while placing: preview the decoration there. False if it doesn't fit. */
  pick(tile: TileCoord): boolean {
    const mode = this.mode();
    if (!mode) return false;
    const at = decorAnchorFor(mode.itemId, this.player.room(), tile, this.garden.decorations(), this.movingId());
    if (at) this.candidate.set(at);
    return !!at;
  }

  async confirm(): Promise<DecorOutcome | null> {
    const mode = this.mode();
    const at = this.candidate();
    if (!mode || !at) return null;
    const name = this.item()?.name;
    const result =
      mode.kind === 'PLACE'
        ? await this.garden.placeDecor(mode.itemId, this.player.room(), at)
        : await this.garden.moveDecor(mode.decorId, at);
    if (!result.ok) return result;
    this.clear();
    return { ok: true, message: t(mode.kind === 'PLACE' ? '{name} is up!' : '{name} moved.', { name: t(name ?? '') }) };
  }

  async putAway(): Promise<DecorOutcome | null> {
    const d = this.selected();
    if (!d) return null;
    const name = this.item()?.name;
    const result = await this.garden.putAwayDecor(d.id);
    if (!result.ok) return result;
    this.clear();
    return { ok: true, message: t('{name} is back in the inventory.', { name: t(name ?? '') }) };
  }

  async water(): Promise<DecorOutcome | null> {
    const d = this.selected();
    if (!d) return null;
    const result = await this.garden.waterDecor(d.id);
    if (!result.ok) return result;
    return { ok: true, message: t('Watered {what}. 💧', { what: t(`the ${this.item()?.name.toLowerCase()}`) }) };
  }

  /** Open a placed decoration's menu. */
  select(decorId: string): void {
    this.clear();
    this.selectedId.set(decorId);
  }

  /** Close the bar: stop placing or moving, and deselect. */
  clear(): void {
    this.mode.set(null);
    this.candidate.set(null);
    this.selectedId.set(null);
  }

  private begin(mode: DecorMode): void {
    this.clear();
    this.mode.set(mode);
  }
}
