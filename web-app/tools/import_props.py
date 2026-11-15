"""
Import the design team's prop sprites into the game.

    python3 tools/import_props.py "<folder with a delivered sprite pack>"

This cleans and trims each sprite (so its feet sit on its footprint), sizes it for the game
(PROPS sets each one's scale; the file is kept at 2x), writes
apps/web/public/assets/game/<folder>/prop-<kind>.png and marks it delivered. It prints the game
size, which goes in PROP_VISUALS (asset-registry.ts): the game draws the sprite at that size.

A new prop also needs a place in ROOMS (shared/src/contracts/habitat.ts).
Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, add_shadow, clear_background, drop_glow, drop_strays, game_size, mark_delivered, save_scaled, seat_shadows, trim

# Cleanup steps a sprite can ask for (applied in this order, around drop_strays and trim):
#   glow    clear the soft glow painted around it (it reads as haze on the floor)
#   seat    pull a contact shadow exported apart from the piece up under its feet
#   shadow  draw a contact shadow to match the furniture pack's (for art delivered without one)
#   feet    the same, centred on the piece's feet line instead of its lowest pixel (a desk with a stool)
#
# delivered file name → (HabitatProp.kind, asset folder, scale, cleanup steps). A prop with visual
# states (PROP_VISUALS in asset-registry.ts) takes the state too, as KIND_STATE: states without their
# own picture are drawn with the idle one. Packs drawn at 64 px per tile import at half; concept-art
# packs are scaled to the astronaut (36x50).
PROPS: dict[str, tuple[str, str, float, set[str]]] = {
    'r07_02_sign_watering.png': ('WATERING_CAN', 'garden/decorations', 0.5, {'shadow'}),
    'r08_06_greenhouse.png': ('GREENHOUSE', 'garden/decorations', 0.5, {'shadow'}),
    'r08_09_bench.png': ('GARDEN_BENCH', 'garden/decorations', 0.5, {'shadow'}),
    'r08_08_vine_arch.png': ('VINE_ARCH', 'garden/decorations', 0.5, {'shadow'}),
    'r08_04_planter_vines.png': ('VINE_PLANTER', 'garden/decorations', 0.5, {'shadow'}),
    # Social Space 2x pack
    'floor_lamp_64x192.png': ('FLOOR_LAMP', 'social/decorations', 0.5, set()),
    'vines_top_left_192x192.png': ('VINES_LEFT', 'social/decorations', 0.5, set()),
    'vines_top_right_192x192.png': ('VINES_RIGHT', 'social/decorations', 0.5, set()),
    # Planters & pots pack: a pot about knee-to-waist high on the astronaut.
    'pot_lavender.png': ('POT_LAVENDER', 'social/decorations', 0.13, {'shadow'}),
    'pot_pink_flowers.png': ('POT_PINK_FLOWERS', 'social/decorations', 0.13, {'shadow'}),
    'pot_monstera.png': ('POT_MONSTERA', 'social/decorations', 0.13, {'shadow'}),
    'planter_lavender.png': ('PLANTER_LAVENDER', 'social/decorations', 0.13, {'shadow'}),
    'planter_red_flowers.png': ('PLANTER_RED_FLOWERS', 'social/decorations', 0.13, {'shadow'}),
    # Supply kiosk: stands on the floor at the top right, about as tall as the board.
    'supply_kiosk.png': ('SUPPLY_STORE', 'social/store', 0.08, set()),
    # Furniture-with-shadows pack: an armchair about 80% of the astronaut's height, a pouf knee-high.
    'armchair_left.png': ('ARMCHAIR_LEFT', 'social/decorations', 0.15, {'seat'}),
    'armchair_right.png': ('ARMCHAIR_RIGHT', 'social/decorations', 0.15, {'seat'}),
    'pouf_bottom_left.png': ('POUF_BOTTOM_LEFT', 'social/decorations', 0.15, {'seat'}),
    'pouf_bottom_right.png': ('POUF_BOTTOM_RIGHT', 'social/decorations', 0.15, {'seat'}),
    'sofa_with_blanket.png': ('SOFA', 'social/decorations', 0.105, {'seat'}),
    # Table & rug pack: the decorated coffee table, about two astronauts wide.
    'coffee_table_decorated.png': ('COFFEE_TABLE', 'social/decorations', 0.175, {'glow'}),
    # Medical Station desk ("Pixel-Art Sci-Fi Medical Station.png", renamed): desk at the
    # astronaut's waist, the stool knee-high.
    'medical_terminal.png': ('MEDICAL_TERMINAL_IDLE', 'medical/terminal', 0.074, {'feet'}),
    # Health Insights console ("Pixel-Art Futuristic Health Console.png", renamed): the same scale
    # as the terminal, so their stools match.
    'health_insights.png': ('HEALTH_INSIGHTS_IDLE', 'medical/insights', 0.074, {'feet'}),
    # Medical Bay furniture pack (Medical_Bay_Furniture_Export.zip): one sheet, so one scale keeps
    # the pieces matched; the scan pod's figure is about the astronaut's height.
    '01_patient_bed_alcove.png': ('MED_BED', 'medical/decorations', 0.2, {'feet'}),
    '02_medicine_shelf.png': ('MED_SHELF', 'medical/decorations', 0.2, {'feet'}),
    '03_medical_locker.png': ('MED_LOCKER', 'medical/decorations', 0.2, {'feet'}),
    '04_body_scan_pod.png': ('MED_SCAN_POD', 'medical/decorations', 0.2, {'feet'}),
    '05_supply_cart.png': ('MED_CART', 'medical/decorations', 0.17, {'feet'}),
    # Waiting bench seen from behind ("Rear-View Lavender Sci-Fi Bench-1.png", renamed): it stands
    # against the bottom wall facing into the room; as wide as the sheet's front-view bench.
    'bench_rear.png': ('MED_BENCH_BACK', 'medical/decorations', 0.054, {'feet'}),
    '10_large_leafy_plant.png': ('MED_POT_LEAFY', 'medical/decorations', 0.18, {'shadow'}),
    '11_lavender_potted_plant.png': ('MED_POT_LAVENDER', 'medical/decorations', 0.18, {'shadow'}),
}


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    found = {p.name: p for p in Path(sys.argv[1]).expanduser().rglob('*.png')}
    keys = []
    for name, (kind, folder, scale, steps) in PROPS.items():
        if name not in found:
            continue  # from another pack: run the tool on each pack's folder
        im = Image.open(found[name])
        if im.mode == 'RGB':  # no alpha: a flat background to clear
            im = clear_background(im)
        if 'glow' in steps:
            im = drop_glow(im)
        im = drop_strays(im)
        if 'seat' in steps:
            im = seat_shadows(im)
        im = trim(im)
        if steps & {'shadow', 'feet'}:
            im = add_shadow(im, feet='feet' in steps)
        size = game_size(im, scale)
        key = 'prop-' + kind.lower().replace('_', '-')  # propTextureKey(kind, state)
        save_scaled(im, size, ASSETS / folder / f'{key}.png')
        keys.append(key)
        print(f'{kind:14} {size[0]}x{size[1]}')
    mark_delivered(*keys)


if __name__ == '__main__':
    main()
