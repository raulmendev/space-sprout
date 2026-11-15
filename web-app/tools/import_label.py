"""
Import the design team's plant label (a sign on two posts, empty cream panel) into the game.

    python3 tools/import_label.py "<the delivered PNG>"

The picture comes on a flat black background: it's cleared with a tight tolerance, since the
frame's dark purple outline is close to black, and so is the black showing between the posts. Writes three pictures, two under
apps/web/public/assets/game/garden/labels (and the store card) and marks them delivered:

- plant-label: the sign that pops up above a named plant (and in its close-up), with the name
  drawn on the panel. It's shown at a fixed size on screen like the name tags, so it's kept at
  4x its registered size to stay sharp on 3x phones.
- plant-label-mini: the little sign that stands by every named plant in the garden.
- store-plant-label: its Supply Store card (the sign fitted to the card, like the decorations').

If the panel moves in new art, update LABEL_PANEL in apps/web/src/app/garden/game/asset-registry.ts
(printed below, as fractions of the picture). Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, ICON, clear_background, icon_from, mark_delivered, save_scaled, trim

# key → (registered width, pixels per registered pixel); the height follows the art.
# The big sign is shown at a fixed size on screen (see above); the little one is ordinary 2x room art.
PIECES = {'plant-label': (144, 4), 'plant-label-mini': (26, 2)}


def panel(im: Image.Image) -> tuple[float, float, float, float]:
    """The writable cream area inside the panel's orange line, as fractions: left, top, right, bottom.
    Walks out from a point on the panel until it meets the line (the paper's stains are cream too)."""
    px = im.load()
    w, h = im.size
    cream = lambda x, y: px[x, y][3] and px[x, y][0] > 235 and px[x, y][1] > 180 and px[x, y][2] > 130
    cx, cy = w // 2, round(h * 0.33)

    def walk(x: int, y: int, dx: int, dy: int) -> tuple[int, int]:
        while cream(x + dx, y + dy):
            x, y = x + dx, y + dy
        return x, y

    left, right = walk(cx, cy, -1, 0)[0], walk(cx, cy, 1, 0)[0]
    top, bottom = walk(cx, cy, 0, -1)[1], walk(cx, cy, 0, 1)[1]
    return left / w, top / h, (right + 1) / w, (bottom + 1) / h


def clear_holes(im: Image.Image, darkest: int = 12) -> Image.Image:
    """Clear the background left in holes the edge flood can't reach (under the panel, between the
    posts). Only pure black goes: the art's darkest outline is well above it."""
    r, g, b, a = im.split()
    dark = Image.eval(Image.merge('RGB', (r, g, b)).convert('L'), lambda v: 255 if v <= darkest else 0)
    return Image.merge('RGBA', (r, g, b, Image.composite(Image.new('L', im.size, 0), a, dark)))


def main(src: Path) -> None:
    im = trim(clear_holes(clear_background(Image.open(src), tolerance=30)))
    for key, (width, detail) in PIECES.items():
        size = (width, round(im.height * width / im.width))
        save_scaled(im, size, ASSETS / 'garden/labels' / f'{key}.png', detail)
        print(f'{key:18} {size[0]}x{size[1]}')
    save_scaled(icon_from(im), (ICON, ICON), ASSETS / 'gui/store/store-plant-label.png')
    print('panel', ', '.join(f'{v:.3f}' for v in panel(im)))
    mark_delivered(*PIECES, 'store-plant-label')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).expanduser())
