"""
Import the design team's prop sprites into the game.

    python3 tools/import_props.py "<folder with a delivered sprite pack>"

This cleans and trims each sprite (so its feet sit on its footprint), sizes it for the game
(PROPS sets each one's scale; the file is kept at 2x), writes
apps/web/public/assets/game/<folder>/prop-<kind>.png and marks it delivered. It prints the game
size, which goes in PROP_VISUALS (asset-registry.ts): the game draws the sprite at that size.

A new prop also needs a place in ROOMS (packages/shared/src/contracts/habitat.ts).
Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, drop_glow, game_size, largest_part, mark_delivered, save_scaled, trim

# delivered file name → (HabitatProp.kind, asset folder, scale). Packs drawn at 64 px per tile
# import at half; the Social Space sketch cut-outs were at game scale, sized to the room's mockup.
PROPS = {
    'r07_02_sign_watering.png': ('WATERING_CAN', 'garden/decorations', 0.5),
    'r08_06_greenhouse.png': ('GREENHOUSE', 'garden/decorations', 0.5),
    'r08_09_bench.png': ('GARDEN_BENCH', 'garden/decorations', 0.5),
    'r08_08_vine_arch.png': ('VINE_ARCH', 'garden/decorations', 0.5),
    'r08_04_planter_vines.png': ('VINE_PLANTER', 'garden/decorations', 0.5),
    # Social Space sprites (2x pack). The art fills about two thirds of its canvas, so the
    # stations and the planter are scaled up to the size their canvas was meant to be.
    'earth_link_192x160.png': ('COMM_TERMINAL', 'social/decorations', 0.75),
    'supply_store_256x160.png': ('SUPPLY_STORE', 'social/store', 0.75),
    'floor_lamp_64x192.png': ('FLOOR_LAMP', 'social/decorations', 0.5),
    'front_flower_planter_192x128.png': ('FLOWER_PLANTER', 'social/decorations', 0.65),
    'vines_top_left_192x192.png': ('VINES_LEFT', 'social/decorations', 0.5),
    'vines_top_right_192x192.png': ('VINES_RIGHT', 'social/decorations', 0.5),
    # Lounge set (chair & pouf pack), sized to the astronaut (36x50): an armchair about 80% of
    # their height, a pouf knee-high.
    'armchair_left.png': ('ARMCHAIR_LEFT', 'social/decorations', 0.15),
    'armchair_right.png': ('ARMCHAIR_RIGHT', 'social/decorations', 0.15),
    'pouf_bottom_left.png': ('POUF_BOTTOM_LEFT', 'social/decorations', 0.15),
    'pouf_bottom_right.png': ('POUF_BOTTOM_RIGHT', 'social/decorations', 0.15),
    # Sofa pack: the sofa behind the coffee table (with its throw, as in the target mockup).
    'sofa_with_blanket.png': ('SOFA', 'social/decorations', 0.105),
    # Table & rug pack: the decorated coffee table, about two astronauts wide.
    'coffee_table_decorated.png': ('COFFEE_TABLE', 'social/decorations', 0.175),
    # Social Space sketch cut-outs (game scale, sized to the room's mockup)
    'planta_maceta.png': ('POTTED_PLANT', 'medical/terminal', 0.6),
}

# Sprites exported with a soft glow painted around them (it reads as haze on the floor).
GLOW_HALO = {'coffee_table_decorated.png'}


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    found = {p.name: p for p in Path(sys.argv[1]).expanduser().rglob('*.png')}
    keys = []
    for name, (kind, folder, scale) in PROPS.items():
        if name not in found:
            continue  # props from another pack
        im = Image.open(found[name])
        if name in GLOW_HALO:
            im = drop_glow(im)
        im = trim(largest_part(im))
        size = game_size(im, scale)
        key = 'prop-' + kind.lower().replace('_', '-')  # propTextureKey(kind)
        save_scaled(im, size, ASSETS / folder / f'{key}.png')
        keys.append(key)
        print(f'{kind:14} {size[0]}x{size[1]}')
    mark_delivered(*keys)


if __name__ == '__main__':
    main()
