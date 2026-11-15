"""
Import the design team's pot for potted plants into the game.

    python3 tools/import_pot.py "<delivered pot picture>"

The pot is drawn in two layers around the plant: the whole pot behind it (with the furniture's
contact shadow) and its front, without the opening, over it, so the plant grows out of the pot.
This clears the picture's flat background, trims it, finds the opening (the dark area inside the
rim, filled from the middle of the rim) and cuts the front layer below it. Both layers are written
at 2x, 45 px wide in the game, as social/decorations/decor-pot.png and decor-pot-front.png.

The printed game size goes in POT_SIZE (asset-registry.ts). If the opening sits much higher or
lower than the last pot's, adjust POTTED_PLANT_BASE (habitat.store.ts). Needs Pillow.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

from art import ASSETS, HI_RES, add_shadow, clear_background, drop_strays, mark_delivered, trim

GAME_WIDTH = 45
# Darker than this (0-255 luminance) is the pot's opening; the rim and body are lighter.
OPENING_LUMA = 70


def luma(p: tuple[int, ...]) -> float:
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def opening(pot: Image.Image) -> set[tuple[int, int]]:
    """The opening's pixels: down the middle column into the rim, then on into the dark inside, and
    filled from there."""
    px, (w, h) = pot.load(), pot.size
    x, y = w // 2, 0
    while not (px[x, y][3] > 200 and luma(px[x, y]) > 120):  # through the outline into the rim
        y += 1
    while luma(px[x, y]) >= OPENING_LUMA:  # through the rim into the opening
        y += 1
    found: set[tuple[int, int]] = set()
    todo = deque([(x, y)])
    while todo:
        x, y = todo.popleft()
        if (x, y) in found or not (0 <= x < w and 0 <= y < h):
            continue
        if px[x, y][3] < 200 or luma(px[x, y]) >= OPENING_LUMA:
            continue
        found.add((x, y))
        todo.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return found


def front_of(pot: Image.Image, hole: set[tuple[int, int]]) -> Image.Image:
    """The pot without its opening and everything above it (the back of the rim): what covers the plant."""
    bottom: dict[int, int] = {}
    for x, y in hole:
        bottom[x] = max(bottom.get(x, -1), y)
    front = pot.copy()
    px = front.load()
    for x, last in bottom.items():
        for y in range(last + 1):
            px[x, y] = (0, 0, 0, 0)
    return front


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    pot = trim(drop_strays(clear_background(Image.open(Path(sys.argv[1]).expanduser()), tolerance=40)))
    front = front_of(pot, opening(pot))
    w = GAME_WIDTH * HI_RES
    h = round(pot.height * w / pot.width)
    back = add_shadow(pot.resize((w, h), Image.LANCZOS))
    height = -(-back.height // HI_RES) * HI_RES  # whole game pixels
    out = ASSETS / 'social/decorations'
    for name, layer in (('decor-pot', back), ('decor-pot-front', front.resize((w, h), Image.LANCZOS))):
        canvas = Image.new('RGBA', (w, height), (0, 0, 0, 0))
        canvas.alpha_composite(layer, (0, 0))  # same canvas for both layers, so they line up
        canvas.save(out / f'{name}.png', optimize=True)
    mark_delivered('decor-pot', 'decor-pot-front')
    print(f'POT_SIZE {GAME_WIDTH}x{height // HI_RES}')


if __name__ == '__main__':
    main()
