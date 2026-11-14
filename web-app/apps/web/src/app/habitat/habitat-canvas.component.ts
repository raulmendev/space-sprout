import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, output, signal, viewChild } from '@angular/core';
import type { HabitatInteraction } from '@garden/shared';
import { AssetService } from '../shared/assets.service';
import { HabitatStore } from './habitat.store';
import { HabitatRenderer, createHabitatRenderer } from '../garden/game/habitat-renderer';
import { WORLD_H, WORLD_W, TileCoord } from '../garden/game/tile-manager';

/** Integer zoom when it fills at least this share of the space; otherwise fractional. */
const MIN_INTEGER_FILL = 0.8;

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
  readonly zoom = signal(1);
  protected readonly width = computed(() => Math.round(WORLD_W * this.zoom()));
  protected readonly height = computed(() => Math.round(WORLD_H * this.zoom()));

  private readonly habitat = inject(HabitatStore);
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
    effect(() => this.renderer()?.setGhost(this.habitat.ghost()));
    effect(() => this.renderer()?.setZoom(this.zoom()));
  }

  flashTile(tile: TileCoord): void {
    this.renderer()?.flashTile(tile);
  }

  private fit(slot: HTMLElement): void {
    const top = slot.getBoundingClientRect().top;
    const availW = slot.clientWidth - 24; // frame border + padding
    const availH = window.innerHeight - top - 40;
    const scale = Math.max(0.5, Math.min(availW / WORLD_W, availH / WORLD_H));
    const n = Math.floor(scale);
    this.zoom.set(n >= 1 && n >= scale * MIN_INTEGER_FILL ? n : scale);
  }
}
