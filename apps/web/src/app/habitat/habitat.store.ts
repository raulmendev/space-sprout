import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HABITAT_PROPS,
  HabitatInteraction,
  InsightsDisplayState,
  MedicalTerminalState,
  MessageBoardState,
  NPC_RECT,
  PropInteraction,
  TileCoord,
  TileRect,
  footprintTiles,
  getPlantStage,
  getTileKind,
  isNpcTile,
  objectRect,
  propAtTile,
  propInteraction,
  zoneAt,
} from '@garden/shared';
import { GardenStore } from '../garden/garden.store';
import {
  HINT_TEXTURE,
  NPC_TEXTURE,
  PLAYER_TEXTURE,
  plantSways,
  plantTextureKey,
  propPulses,
  propTextureKey,
} from '../garden/game/asset-registry';
import { PlayerStore, STEP_MS } from './player.store';
import type { HabitatRenderState, RenderSprite } from '../garden/game/habitat.scene';

/** A panel is identified by the station interaction that opens it. */
export type HabitatPanel = PropInteraction;

/** Characters draw in front of plants/props that share their ground row. */
const CHARACTER_DEPTH_BIAS = 0.5;

/**
 * Habitat UI state: what is hovered/selected, which panel is open, prop visual
 * states, and the render state handed to Phaser.
 */
@Injectable({ providedIn: 'root' })
export class HabitatStore {
  private readonly garden = inject(GardenStore);
  private readonly player = inject(PlayerStore);

  readonly hover = signal<HabitatInteraction | null>(null);
  readonly selection = signal<HabitatInteraction | null>(null);
  readonly openPanel = signal<HabitatPanel | null>(null);
  /** Debug aid for the layout checkpoint: outline zones and footprints. */
  readonly showLayout = signal(false);

  /** Visual state per stateful prop kind. */
  readonly propStates = {
    MEDICAL_TERMINAL: signal<MedicalTerminalState>('idle'),
    HEALTH_INSIGHTS: signal<InsightsDisplayState>('idle'),
    MESSAGE_BOARD: signal<MessageBoardState>('idle'),
  } as const;

  readonly renderState = computed<HabitatRenderState>(() => {
    const now = this.garden.now();
    const sprites: RenderSprite[] = [];

    for (const p of HABITAT_PROPS) {
      const state = this.propStates[p.kind as keyof typeof this.propStates]?.();
      sprites.push({
        id: `prop:${p.id}`,
        texture: propTextureKey(p.kind, state),
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        interaction: propInteraction(p),
        pulse: propPulses(p.kind, state),
      });
    }

    const wetTiles: TileCoord[] = [];
    for (const o of this.garden.objects()) {
      const rect = objectRect(o);
      const stage = getPlantStage(o, now);
      sprites.push({
        id: o.id,
        texture: plantTextureKey(o.itemType, stage),
        ...rect,
        interaction: { type: 'PLANT_SELECTED', plantId: o.id },
        sway: stage === 'MATURE' && plantSways(o.itemType),
      });
      wetTiles.push(...footprintTiles(rect));
    }

    sprites.push({ id: 'npc', texture: NPC_TEXTURE, ...NPC_RECT, interaction: { type: 'NPC_SELECTED' }, depthBias: CHARACTER_DEPTH_BIAS });
    sprites.push({
      id: 'player',
      texture: PLAYER_TEXTURE,
      ...this.player.tile(),
      w: 1,
      h: 1,
      interaction: null,
      moveMs: STEP_MS,
      flipX: this.player.facingLeft(),
      depthBias: CHARACTER_DEPTH_BIAS,
    });
    return { sprites, wetTiles };
  });

  readonly hoverRect = computed(() => this.targetRect(this.hover()));
  readonly selectionRect = computed(() => {
    const s = this.selection();
    return s?.type === 'NPC_SELECTED' ? null : this.targetRect(s);
  });

  /** "+" over an empty plot under the pointer, so plantable spots are self-evident. */
  readonly ghost = computed(() => {
    const h = this.hover();
    if (h?.type !== 'PLOT_SELECTED' || this.garden.pickerTile() || this.garden.closeupId()) return null;
    return this.garden.isEmptyPlot(h) ? { x: h.x, y: h.y, texture: HINT_TEXTURE } : null;
  });

  /** Info for the "Look closer" panel when a plain tile or decoration is selected. */
  readonly selectedInfo = computed(() => {
    const s = this.selection();
    if (!s) return null;
    if (s.type === 'PROP_SELECTED') {
      const prop = HABITAT_PROPS.find((p) => p.id === s.propId);
      return prop ? { title: prop.name, zone: prop.zone, kind: null } : null;
    }
    if (s.type === 'TILE_SELECTED' || s.type === 'PLOT_SELECTED') {
      return { title: null, zone: zoneAt(s.x, s.y), kind: getTileKind(s.x, s.y) ?? null };
    }
    return null;
  });

  /** Footprint of whatever an interaction refers to (what the player walks up to). */
  targetRect(i: HabitatInteraction | null): TileRect | null {
    if (!i) return null;
    switch (i.type) {
      case 'PLANT_SELECTED': {
        const o = this.garden.objects().find((p) => p.id === i.plantId);
        return o ? objectRect(o) : null;
      }
      case 'PLOT_SELECTED':
      case 'TILE_SELECTED':
        return { x: i.x, y: i.y, w: 1, h: 1 };
      case 'NPC_SELECTED':
        return NPC_RECT;
      case 'PROP_SELECTED':
        return HABITAT_PROPS.find((p) => p.id === i.propId) ?? null;
      default:
        return HABITAT_PROPS.find((p) => p.interaction === i.type) ?? null;
    }
  }

  /**
   * Resolve tile clicks to what is actually there (a plant's transparent pixels,
   * or a prop's footprint), so every click lands on the obvious target.
   */
  resolve(i: HabitatInteraction): HabitatInteraction {
    if (i.type !== 'TILE_SELECTED' && i.type !== 'PLOT_SELECTED') return i;
    const plant = this.garden.plantAt(i);
    if (plant) return { type: 'PLANT_SELECTED', plantId: plant.id };
    const prop = propAtTile(i.x, i.y);
    if (prop) return propInteraction(prop);
    if (isNpcTile(i.x, i.y)) return { type: 'NPC_SELECTED' };
    return i;
  }
}
