"""
Import the design team's prop sprites into the game.

    python3 tools/import_props.py "<folder with the delivered sprites>"

The sprites come at the room picture's scale (64 px per game tile). This cleans and trims each
one (so its feet sit on its footprint), halves it with LANCZOS as the room picture was, writes
apps/web/public/assets/game/garden/decorations/prop-<kind>.png and marks it delivered.

A new prop also needs a row in PROP_VISUALS (asset-registry.ts; its size only sizes the
placeholder) and a place in ROOMS (shared/src/contracts/habitat.ts).
Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, mark_delivered, save_scaled, trim

FOLDER = ASSETS / 'garden/decorations'
SCALE = 0.5

# delivered file name → HabitatProp.kind
PROPS = {
    'r07_02_sign_watering.png': 'WATERING_CAN',
    'r08_06_greenhouse.png': 'GREENHOUSE',
    'r08_09_bench.png': 'GARDEN_BENCH',
    'r08_08_vine_arch.png': 'VINE_ARCH',
    'r08_04_planter_vines.png': 'VINE_PLANTER',
}


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    found = {p.name: p for p in Path(sys.argv[1]).expanduser().rglob('*.png')}
    keys = []
    for name, kind in PROPS.items():
        if name not in found:
            print(f'skip {name} (not delivered)')
            continue
        im = trim(Image.open(found[name]))
        size = (max(1, round(im.width * SCALE)), max(1, round(im.height * SCALE)))
        key = 'prop-' + kind.lower().replace('_', '-')  # propTextureKey(kind)
        save_scaled(im, size, FOLDER / f'{key}.png')
        keys.append(key)
        print(f'{kind:14} {size[0]}x{size[1]}')
    mark_delivered(*keys)


if __name__ == '__main__':
    main()
