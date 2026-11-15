"""
Import the design team's message board and its notes into the game.

    python3 tools/import_board.py "<folder with the delivered board pack>"

Takes community_board_empty_*.png (cleaned and trimmed: it stands on its legs), the three
note_*.png (on their full canvas, so they stay centred on their pin slot) and
gui_note_bubble_*.png (trimmed: it floats from its bottom point). Writes them under
apps/web/public/assets/game at 2x and marks them delivered; the printed game sizes go in
notice-board.ts (BOARD_SIZE) and asset-registry.ts (the bubble).

If the board's cork or proportions change, update BOARD_SIZE, NOTE_SLOTS and BUBBLE_AT in
apps/web/src/app/garden/game/notice-board.ts to match. Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image

from art import ASSETS, game_size, mark_delivered, save_scaled, trim

SCALE = 0.5  # delivered at 64 px per tile

# file name prefix → (asset path, trim the margin?)
PIECES = {
    'community_board_empty': ('social/board/prop-message-board.png', True),
    'note_astronaut': ('social/board/note-astronaut.png', False),
    'note_family': ('social/board/note-family.png', False),
    'note_more': ('social/board/note-more.png', False),
    'gui_note_bubble': ('gui/icons/gui-note-bubble.png', True),
}


def main(src: Path) -> None:
    keys = []
    for prefix, (path, trimmed) in PIECES.items():
        found = sorted(src.rglob(f'{prefix}*.png'))
        if not found:
            print(f'skip {prefix} (not delivered)')
            continue
        im = Image.open(found[0]).convert('RGBA')
        if trimmed:
            im = trim(im)
        size = game_size(im, SCALE)
        out = ASSETS / path
        save_scaled(im, size, out)
        keys.append(out.stem)
        print(f'{out.stem:20} {size[0]}x{size[1]}')
    mark_delivered(*keys)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).expanduser())
