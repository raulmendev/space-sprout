"""Shared steps for the tools that import the design team's art. Needs Pillow."""
import json
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / 'apps/web/public/assets/game'
MANIFEST = ASSETS / 'manifest.json'


def trim(im: Image.Image) -> Image.Image:
    """Clean the alpha (drop the faint halo exports carry, make near-opaque fully opaque) and trim the empty margin."""
    r, g, b, a = im.convert('RGBA').split()
    a = a.point(lambda v: 0 if v < 16 else (255 if v >= 250 else v))
    return Image.merge('RGBA', (r, g, b, a)).crop(a.getbbox())


# Art is kept at 2x its game size (64 px per tile): the game draws it at its registered size on a
# canvas that renders at the screen's resolution, so the extra pixels show as detail.
HI_RES = 2


def game_size(im: Image.Image, scale: float) -> tuple[int, int]:
    """Size in game pixels (32 per tile) of art drawn `scale` times its delivered size."""
    return max(1, round(im.width * scale)), max(1, round(im.height * scale))


def drop_glow(im: Image.Image, below: int = 128) -> Image.Image:
    """Clear the soft glow some exports paint around a sprite (it reads as haze on the floor):
    pixels under `below` alpha become transparent. Solid art is unaffected."""
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    return Image.merge('RGBA', (r, g, b, a.point(lambda v: 0 if v < below else v)))


def largest_part(im: Image.Image) -> Image.Image:
    """Keep only the biggest connected shape: drops slivers of neighbouring sprites and stray
    shadow lines an automatic cut-out can leave. Run before trim()."""
    im = im.convert('RGBA')
    w, h = im.size
    alpha = im.getchannel('A').load()
    seen = bytearray(w * h)
    best: list[int] = []
    for start in range(w * h):
        if seen[start] or alpha[start % w, start // w] < 16:
            continue
        part, stack = [], [start]
        seen[start] = 1
        while stack:
            i = stack.pop()
            part.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not seen[j] and alpha[nx, ny] >= 16:
                    seen[j] = 1
                    stack.append(j)
        if len(part) > len(best):
            best = part
    mask = Image.new('L', im.size, 0)
    px = mask.load()
    for i in best:
        px[i % w, i // w] = 255
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def save_scaled(im: Image.Image, size: tuple[int, int], out: Path) -> None:
    """Save at HI_RES times the game `size` (LANCZOS when it has to be resized)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    target = (size[0] * HI_RES, size[1] * HI_RES)
    (im if im.size == target else im.resize(target, Image.LANCZOS)).save(out, optimize=True)


def mark_delivered(*keys: str) -> None:
    """Add asset keys to manifest.json → delivered (sorted, no duplicates)."""
    manifest = json.loads(MANIFEST.read_text())
    manifest['delivered'] = sorted(set(manifest['delivered']) | set(keys))
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
