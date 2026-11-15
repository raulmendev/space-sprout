import { Injectable, computed, inject, signal } from '@angular/core';
import { canTakeDown, type SocialNote } from '@garden/shared';
import { LOCAL_PLAYER } from '../garden/garden.service';
import { ASTRONAUT_USER, CURRENT_USER, FAMILY_USER, isAstronaut } from '../session/current-user';
import { GardenStore } from '../garden/garden.store';
import { loadJson, saveJson } from '../shared/storage';

// What you've read is per player; the astronaut keeps the original key.
const READ_KEY = CURRENT_USER.role === 'FAMILY' ? 'jardin-comunal:notes-read:family:v1' : 'jardin-comunal:notes-read:v1';
const REMOVED_DEMO_KEY = 'jardin-comunal:notes-removed:v1';
const FAMILY_ID = FAMILY_USER.id;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Demo notes until the backend exists. Ids are stable so "read" survives a reload. */
const DEMO_NOTES: SocialNote[] = [
  { id: 'demo-note-1', authorId: FAMILY_ID, content: 'The sunflower you planted is taller than Lucía now! 🌻', createdAt: minutesAgo(25) },
  { id: 'demo-note-2', authorId: ASTRONAUT_USER.id, content: 'Saw 16 sunrises today. Thinking of you at every one.', createdAt: minutesAgo(180) },
  { id: 'demo-note-3', authorId: FAMILY_ID, content: "Dinner at grandma's on Sunday. We'll call you after!", createdAt: minutesAgo(600) },
];

/**
 * The shared message board (astronaut ↔ family): demo notes plus the ones pinned here, which
 * the garden save holds together with the post-it stock they use. This store adds what's
 * per-viewer: which notes you've read.
 */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly garden = inject(GardenStore);
  /** Demo notes you've taken down (demo scaffolding; real notes are deleted from the save). */
  private readonly removedDemo = signal<ReadonlySet<string>>(new Set(loadJson<string[]>(REMOVED_DEMO_KEY, [])));
  private readonly readIds = signal<ReadonlySet<string>>(new Set(loadJson<string[]>(READ_KEY, [])));

  readonly notes = computed(() => [...DEMO_NOTES.filter((n) => !this.removedDemo().has(n.id)), ...this.garden.notes()]);
  readonly newestFirst = computed(() => [...this.notes()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  /** Notes from the other side that you haven't opened the board to see. */
  readonly unread = computed(() => this.notes().filter((n) => !this.isMine(n) && !this.readIds().has(n.id)).length);

  isMine(note: SocialNote): boolean {
    return note.authorId === LOCAL_PLAYER.id;
  }

  /** Who wrote it, for the note's colour and avatar: the astronaut or the family. */
  fromAstronaut(note: SocialNote): boolean {
    return isAstronaut(note.authorId);
  }

  /** "You" for your own notes, otherwise who wrote it. */
  author(note: SocialNote): string {
    if (this.isMine(note)) return 'You';
    return this.fromAstronaut(note) ? ASTRONAUT_USER.displayName : FAMILY_USER.displayName;
  }

  canTakeDown(note: SocialNote): boolean {
    return canTakeDown(note, LOCAL_PLAYER.id);
  }

  markAllRead(): void {
    if (!this.unread()) return;
    const ids = new Set(this.notes().map((n) => n.id));
    this.readIds.set(ids);
    saveJson(READ_KEY, [...ids]);
  }

  /** Pin a note, using one post-it. False for an empty note or an empty stock. */
  async post(content: string): Promise<boolean> {
    return (await this.garden.postNote(content)).ok;
  }

  /** Take one of your own notes off the board. False if it isn't yours. */
  async takeDown(note: SocialNote): Promise<boolean> {
    if (!this.canTakeDown(note)) return false;
    if (!DEMO_NOTES.some((n) => n.id === note.id)) return this.garden.takeDownNote(note.id);
    this.removedDemo.update((ids) => new Set([...ids, note.id]));
    saveJson(REMOVED_DEMO_KEY, [...this.removedDemo()]);
    return true;
  }
}
