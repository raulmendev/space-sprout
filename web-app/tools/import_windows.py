"""
Import a room's animated windows (the sky outside) into the game.

    python3 tools/import_windows.py <room> "<folder with the delivered windows pack>"

e.g. `python3 tools/import_windows.py social ~/Downloads/Social_Space_Animated_Windows_2x`.

The pack's manifest.json gives the frames (*window_overlay_NN.png: just the glass, transparent
elsewhere), where they go on the room picture and how long each one shows. Both manifest layouts
the design team has sent are read (Social Space's and Medical Bay's field names). The frames must
be cut from the same room picture the game shows, or the sky won't line up: check one over it.
The frames are copied as habitat/rooms/room-<room>-window-<n>.png (already 2x: 64 px per tile)
and marked delivered.
It prints the ROOM_WINDOWS entry for asset-registry.ts, in game pixels (32 per tile).
"""
import json
import shutil
import sys
from pathlib import Path

from art import ASSETS, HI_RES, mark_delivered


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    room, pack = sys.argv[1].lower(), Path(sys.argv[2]).expanduser()
    spec = json.loads((pack / 'manifest.json').read_text())
    room_px = spec.get('room_size_px') or spec['room_size']
    if room_px != [24 * 32 * HI_RES, 16 * 32 * HI_RES]:
        sys.exit(f'expected a {24 * 32 * HI_RES}x{16 * 32 * HI_RES} room, the pack has {room_px}')
    frames = sorted(pack.glob('*window_overlay_*.png'))
    if len(frames) != spec['frames']:
        sys.exit(f"manifest says {spec['frames']} frames, found {len(frames)}")
    keys = []
    for n, frame in enumerate(frames):
        key = f'room-{room}-window-{n}'
        shutil.copyfile(frame, ASSETS / 'habitat/rooms' / f'{key}.png')
        keys.append(key)
    mark_delivered(*keys)
    x, y = (v // HI_RES for v in spec.get('window_overlay_room_position_px') or spec['overlay_origin'])
    w, h = (v // HI_RES for v in spec.get('window_overlay_px') or spec['overlay_size'])
    ms = spec.get('frame_duration_ms') or spec['duration_ms']
    print(f"roomWindows('{room.upper()}', {{ frames: {len(frames)}, at: [{x}, {y}], size: [{w}, {h}], frameMs: {ms} }});")


if __name__ == '__main__':
    main()
