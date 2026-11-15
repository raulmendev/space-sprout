"""
Import the design team's message board art into the game.

    python3 tools/import_board.py "<path to delivered PNG>"

Cleans the alpha (drops the faint halo, makes near-opaque pixels fully opaque), trims the
empty margin, and scales the board to its in-game size with LANCZOS (as the mustard art was).
Writes apps/web/public/assets/game/social/board/prop-message-board.png.

If the new art's cork or proportions change, update BOARD_SIZE, NOTE_SLOTS and BUBBLE_AT in
apps/web/src/app/garden/game/notice-board.ts to match. Needs Pillow (pip install pillow).
"""
import sys

from PIL import Image

from art import ASSETS, save_scaled, trim

SIZE = (114, 104)  # BOARD_SIZE in notice-board.ts
OUT = ASSETS / 'social/board/prop-message-board.png'


def main(src: str) -> None:
    im = trim(Image.open(src))
    save_scaled(im, SIZE, OUT)
    print(f'{src}: trimmed to {im.size}, saved {SIZE} -> {OUT}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
