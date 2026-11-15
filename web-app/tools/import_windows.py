"""
Import the design team's animated windows for a room into the game.

    python3 tools/import_windows.py <room> "<pack folder>"

The pack holds transparent overlay frames (*_overlay_00.png, _01, …) drawn over the room's
picture, and a manifest.json giving where they go on the 2x room (overlay_origin), their size and
the frame time. This writes apps/web/public/assets/game/habitat/rooms/room-<room>-window-<n>.png
(kept at 2x), marks them delivered and prints the ROOM_WINDOWS entry for asset-registry.ts.
Needs Pillow (pip install pillow).
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, HI_RES, mark_delivered


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    room, pack = sys.argv[1].lower(), Path(sys.argv[2]).expanduser()
    spec = json.loads((pack / 'manifest.json').read_text())
    frames = sorted(p for p in pack.glob('*.png') if re.search(r'_overlay_\d+\.png$', p.name))
    if len(frames) != spec['frames']:
        sys.exit(f"Expected {spec['frames']} *_overlay_NN.png frames in {pack}, found {len(frames)}")
    keys = []
    for i, path in enumerate(frames):
        im = Image.open(path).convert('RGBA')
        if list(im.size) != spec['overlay_size']:
            sys.exit(f"{path.name} is {im.size}, expected {spec['overlay_size']}")
        key = f'room-{room}-window-{i}'
        im.save(ASSETS / 'habitat/rooms' / f'{key}.png', optimize=True)
        keys.append(key)
    mark_delivered(*keys)
    x, y = (v // HI_RES for v in spec['overlay_origin'])
    w, h = (v // HI_RES for v in spec['overlay_size'])
    print(f"{room.upper()}: {{ at: [{x}, {y}], size: [{w}, {h}], frames: {len(keys)}, frameMs: {spec['duration_ms']} }},")


if __name__ == '__main__':
    main()
