import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import Phaser from 'phaser';
import { GardenStore } from '../garden.store';
import { GardenScene } from '../game/garden.scene';
import type { TileCoord } from '../game/tile-manager';
import { TILE_PX } from '../game/plant-sprites';
import { GRID_SIZE } from '@garden/shared';

/** Hosts the Phaser game and keeps it in sync with Angular state. */
@Component({
  selector: 'app-garden-canvas',
  template: `<div #host class="garden-host pixelated aspect-square w-full"></div>`,
  styles: `
    :host { display: block; }
    .garden-host :is(canvas) { display: block; width: 100% !important; height: 100% !important; image-rendering: pixelated; }
  `,
})
export class GardenCanvasComponent {
  readonly tileClicked = output<TileCoord>();
  readonly npcClicked = output<void>();
  /** When true, a small "!" bobs over Sprout. */
  readonly npcAlert = signal(false);

  private readonly store = inject(GardenStore);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly scene = signal<GardenScene | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const scene = new GardenScene({
        onReady: (s) => this.scene.set(s),
        onTileClicked: (t) => this.tileClicked.emit(t),
        onTileHovered: (t) => this.store.hoverTile.set(t),
        onNpcClicked: () => this.npcClicked.emit(),
      });
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: this.host().nativeElement,
        width: GRID_SIZE * TILE_PX,
        height: GRID_SIZE * TILE_PX,
        pixelArt: true,
        backgroundColor: '#3f7d4a',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene,
        banner: false,
      });
      destroyRef.onDestroy(() => game.destroy(true));
    });

    effect(() => this.scene()?.syncObjects(this.store.renderables()));
    effect(() => this.scene()?.setGhost(this.store.ghost()));
    effect(() => this.scene()?.setSelectedTile(this.store.selectedTile()));
    effect(() => this.scene()?.setNpcAlert(this.npcAlert()));
  }

  shakeTile(tile: TileCoord): void {
    this.scene()?.shakeTile(tile);
  }
}
