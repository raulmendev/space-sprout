import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import type { HabitatInteraction } from '@garden/shared';
import { AssetService } from '../shared/assets.service';
import { HabitatStore } from './habitat.store';
import { DecorStore } from '../decor/decor.store';
import { HabitatRenderer, createHabitatRenderer } from '../garden/game/habitat-renderer';
import { WORLD_H, WORLD_W, TileCoord } from '../garden/game/tile-manager';

/** Integer zoom when it fills at least this share of the screen; otherwise fractional (still nearest-neighbour). */
const MIN_INTEGER_FILL = 0.85;

/**
 * Hosts the Phaser habitat. State flows Angular → renderer; interactions flow back out.
 * Sizes itself to the nearest integer zoom that fits its `[data-habitat-slot]` ancestor.
 */
@Component({
  selector: 'app-habitat-canvas',
  host: { class: 'block' },
  template: `<div #host class="pixelated" [style.width.px]="width()" [style.height.px]="height()"></div>`,
})
export class HabitatCanvasComponent {
  readonly interaction = output<HabitatInteraction>();
  /** Share of the game's pictures loaded so far, 0–1. */
  readonly progress = output<number>();
  /** The scene is up and has been given the room. */
  readonly ready = output<void>();
  readonly zoom = signal(1);
  protected readonly width = computed(() => Math.round(WORLD_W * this.zoom()));
  protected readonly height = computed(() => Math.round(WORLD_H * this.zoom()));

  private readonly habitat = inject(HabitatStore);
  private readonly decor = inject(DecorStore);
  private readonly assets = inject(AssetService);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly renderer = signal<HabitatRenderer | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(async () => {
      await this.assets.ready;
      const el = this.host().nativeElement;
      const renderer = createHabitatRenderer(el, this.assets.deliveredKeys(), {
        onInteraction: (i) => this.interaction.emit(i),
        onHover: (i) => this.habitat.hover.set(i),
        onProgress: (share) => this.progress.emit(share),
        onReady: () => this.ready.emit(),
      });
      this.renderer.set(renderer);

      const slot = el.closest<HTMLElement>('[data-habitat-slot]') ?? el.parentElement!;
      const fit = () => this.fit(slot);
      const ro = new ResizeObserver(fit);
      ro.observe(slot);
      window.addEventListener('resize', fit);
      fit();
      destroyRef.onDestroy(() => {
        ro.disconnect();
        window.removeEventListener('resize', fit);
        renderer.destroy();
      });
    });

    effect(() => this.renderer()?.setState(this.habitat.renderState()));
    effect(() => this.renderer()?.setActors(this.habitat.actors()));
    effect(() => this.renderer()?.setHover(this.habitat.hoverRect()));
    effect(() => this.renderer()?.setSelection(this.habitat.selectionRect()));
    effect(() => this.renderer()?.setFocus(this.habitat.reachable()?.rect ?? null));
    effect(() => this.renderer()?.setGhost(this.habitat.ghost()));
    effect(() => this.renderer()?.setSpots(this.decor.spotTiles()));
    effect(() => this.renderer()?.setZoom(this.zoom()));
  }

  flashTile(tile: TileCoord): void {
    this.renderer()?.flashTile(tile);
  }

  private fit(slot: HTMLElement): void {
    const scale = Math.max(0.25, Math.min(slot.clientWidth / WORLD_W, slot.clientHeight / WORLD_H));
    const n = Math.floor(scale);
    this.zoom.set(n >= 1 && n >= scale * MIN_INTEGER_FILL ? n : scale);
  }
}
