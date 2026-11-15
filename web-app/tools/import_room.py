"""
Import the design team's room picture into the game.

    python3 tools/import_room.py <room> "<folder of tile_rNN_cNN.png files, or one PNG>"

The design team delivers a room as one picture cut into a grid of tiles
(tile_r01_c01.png … tile_r08_c12.png, 128 px each). This stitches them back together, paints
out any of our UI that was copied into the picture (the game draws it live), scales it to the
room's size with LANCZOS as the plants and the board were, writes
apps/web/public/assets/game/habitat/rooms/room-<room>.png and marks it delivered.

The picture must keep the room's grid (layout in shared/src/contracts/habitat.ts):
beds, paths and doors on the same tiles. Needs Pillow (pip install pillow).
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from art import ASSETS, mark_delivered

SIZE = (768, 512)  # ROOM_COLS x ROOM_ROWS x TILE_SIZE (habitat.ts)
SOURCE_SIZE = (SIZE[0] * 2, SIZE[1] * 2)  # as delivered: 64 px per game tile

# Our UI baked into a delivered picture, in SOURCE_SIZE pixels:
# (box, x-offset of the clean patch beside it in the same rows).
BAKED_UI = {
    'garden': [
        ((1256, 478, 1435, 535), -256),  # "Social Space →" (the door label is a DOM overlay)
    ],
}


def stitch(src: Path) -> Image.Image:
    if src.is_file():
        return Image.open(src).convert('RGB')
    tiles = {}
    for f in src.glob('tile_r*_c*.png'):
        m = re.fullmatch(r'tile_r(\d+)_c(\d+)\.png', f.name)
        if m:
            tiles[(int(m[1]), int(m[2]))] = Image.open(f).convert('RGB')
    if not tiles:
        sys.exit(f'No tile_rNN_cNN.png files in {src}')
    tw, th = next(iter(tiles.values())).size
    out = Image.new('RGB', (max(c for _, c in tiles) * tw, max(r for r, _ in tiles) * th))
    for (r, c), tile in tiles.items():
        out.paste(tile, ((c - 1) * tw, (r - 1) * th))
    return out


def paint_out(im: Image.Image, boxes) -> None:
    for (x0, y0, x1, y1), dx in boxes:
        patch = im.crop((x0 + dx, y0, x1 + dx, y1))
        mask = Image.new('L', patch.size, 0)
        ImageDraw.Draw(mask).rectangle((3, 3, patch.size[0] - 4, patch.size[1] - 4), fill=255)
        im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(2)))


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    room, src = sys.argv[1].lower(), Path(sys.argv[2]).expanduser()
    im = stitch(src)
    baked = BAKED_UI.get(room, [])
    if baked and im.size != SOURCE_SIZE:
        sys.exit(f'Expected {SOURCE_SIZE} to paint out the baked-in UI, got {im.size}: update BAKED_UI')
    if im.size[0] * SIZE[1] != im.size[1] * SIZE[0]:
        sys.exit(f'Expected a 3:2 picture like {SIZE}, got {im.size}')
    paint_out(im, baked)
    key = f'room-{room}'
    out = ASSETS / 'habitat/rooms' / f'{key}.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    # Lossless: 256 colours flatten the lights' glow and grey out the Earth window.
    im.resize(SIZE, Image.LANCZOS).save(out, optimize=True)
    mark_delivered(key)
    print(f'Wrote {out} {SIZE}')


if __name__ == '__main__':
    main()
