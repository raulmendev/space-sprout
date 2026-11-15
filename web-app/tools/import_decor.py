"""
Import the design team's decorations (store items placed in the station) into the game.

    python3 tools/import_decor.py "<folder with the delivered decoration pictures>"

For each item in DECOR whose picture (<item with _>.png, e.g. photo_frame.png) is in the folder,
this clears a flat background, cleans and trims it, sizes it to its game width (set against the
astronaut, 36x50), adds a contact shadow to things that stand on the floor, writes
apps/web/public/assets/game/social/decorations/decor-<item>.png at 2x and marks it delivered.
It prints the game size, which goes in DECOR_VISUALS (asset-registry.ts).

The store card's picture is gui/store/store-<item>.png (64x64 in the game): the pack's own shop
icon when there is one (e.g. photo_frame_icon.png next to it), else the sprite itself, fitted with a margin.

A new decoration also needs a store item (shared/src/contracts/store.ts) and a row in DECOR_SPECS
(shared/src/contracts/decor.ts). Rename downloads to those names first.
Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, ICON, add_shadow, clear_background, drop_strays, game_size, icon_from, mark_delivered, save_scaled, trim

# store item id → (game width in px, stands on the floor (gets a shadow)). Wall things fit their
# wall tiles; floor things are sized to the astronaut (a lamp about waist high). A sprite may
# overhang its footprint (the rug is wider than its 2x2 tiles).
DECOR: dict[str, tuple[int, bool]] = {
    # Jardin_Comunal_Decorations_Sprites_and_Minis.zip (placeable_sprites/ + shop_icons/)
    'photo-frame': (30, False),
    'earth-poster': (25, False),
    'fairy-lights': (62, False),
    'cozy-rug': (92, False),  # flat on the floor: no shadow
    'star-lamp': (26, True),
    # The second batch (single exports, renamed)
    'terrarium': (30, True),
    'holo-globe': (28, True),
    'keepsake-shelf': (30, False),
    'memory-board': (56, False),
    'galaxy-lamp': (20, True),
}

def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    keys: list[str] = []
    for item, (width, floor) in DECOR.items():
        src = folder / f"{item.replace('-', '_')}.png"
        if not src.exists():
            continue
        im = Image.open(src)
        if im.mode == 'RGB':
            im = clear_background(im)
        clean = trim(drop_strays(im))
        art = add_shadow(clean) if floor else clean
        size = game_size(art, width / art.width)
        save_scaled(art, size, ASSETS / 'social/decorations' / f'decor-{item}.png')
        own_icon = src.with_name(f'{src.stem}_icon.png')
        icon = Image.open(own_icon).convert('RGBA') if own_icon.exists() else icon_from(clean)
        save_scaled(icon, (ICON, ICON), ASSETS / 'gui/store' / f'store-{item}.png')
        keys += [f'decor-{item}', f'store-{item}']
        print(f'{item:16} {size[0]}x{size[1]}')
    mark_delivered(*keys)


if __name__ == '__main__':
    main()
