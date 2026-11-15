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
from pathlib import Path

from PIL import Image

SIZE = (114, 104)  # BOARD_SIZE in notice-board.ts
OUT = Path(__file__).resolve().parent.parent / 'apps/web/public/assets/game/social/board/prop-message-board.png'


def main(src: str) -> None:
    im = Image.open(src).convert('RGBA')
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < 16 else (255 if v >= 250 else v))
    im = Image.merge('RGBA', (r, g, b, a)).crop(a.getbbox())
    out = im.resize(SIZE, Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)
    print(f'{src}: trimmed to {im.size}, saved {SIZE} -> {OUT}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
