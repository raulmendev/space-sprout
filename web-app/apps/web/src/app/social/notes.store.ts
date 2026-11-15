import { Injectable, computed, inject, signal } from '@angular/core';
import { canTakeDown, type SocialNote } from '@garden/shared';
import { type GardenFailure, LOCAL_PLAYER } from '../garden/garden.service';
import { ASTRONAUT_USER, FAMILY_USER, authorOf, isAstronaut, perMemberKey } from '../session/current-user';
import { GardenStore } from '../garden/garden.store';
import { loadJson, saveJson } from '../shared/storage';

// What you've read is per player.
const READ_KEY = perMemberKey('notes-read');
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

  /** Whether an astronaut wrote it (for the avatar and the note on the board's picture). */
  fromAstronaut(note: SocialNote): boolean {
    return isAstronaut(note.authorId);
  }

  /** "You" for your own notes, otherwise who wrote it. */
  author(note: SocialNote): string {
    if (this.isMine(note)) return 'You';
    return authorOf(note.authorId).displayName;
  }

  /** The note's colour: its author's. */
  color(note: SocialNote): string {
    return authorOf(note.authorId).color;
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

  /** Pin a note, using one post-it. Null when pinned, else why not. */
  async post(content: string): Promise<GardenFailure | null> {
    const pinned = await this.garden.postNote(content);
    return pinned.ok ? null : pinned.error;
  }

  /** Take one of your own notes off the board. Null when it's down, else why not. */
  async takeDown(note: SocialNote): Promise<GardenFailure | null> {
    if (!this.canTakeDown(note)) return 'NOT_YOURS';
    if (!DEMO_NOTES.some((n) => n.id === note.id)) {
      const done = await this.garden.takeDownNote(note.id);
      return done.ok ? null : done.error;
    }
    this.removedDemo.update((ids) => new Set([...ids, note.id]));
    saveJson(REMOVED_DEMO_KEY, [...this.removedDemo()]);
    return null;
  }
}
