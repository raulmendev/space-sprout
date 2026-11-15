"""Shared steps for the tools that import the design team's art. Needs Pillow."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

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


def clear_background(im: Image.Image, tolerance: int = 160) -> Image.Image:
    """Make a flat background transparent (art exported without alpha): floods in from the
    picture's edges over pixels close to the corner colour. The sprite's outline stops the flood,
    so light colours inside the sprite are kept."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    bg = px[0, 0][:3]
    close = lambda c: sum(abs(c[k] - bg[k]) for k in range(3)) <= tolerance
    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i] or not close(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                stack.append((nx, ny))
    return im


def drop_glow(im: Image.Image, below: int = 128) -> Image.Image:
    """Clear the soft glow some exports paint around a sprite (it reads as haze on the floor):
    pixels under `below` alpha become transparent. Solid art is unaffected."""
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    return Image.merge('RGBA', (r, g, b, a.point(lambda v: 0 if v < below else v)))


def components(im: Image.Image, min_alpha: int = 16) -> list[list[int]]:
    """The separate shapes in a sprite: lists of pixel indexes (y * width + x), 4-connected,
    over pixels at least `min_alpha` opaque."""
    w, h = im.size
    alpha = im.getchannel('A').load()
    seen = bytearray(w * h)
    parts: list[list[int]] = []
    for start in range(w * h):
        if seen[start] or alpha[start % w, start // w] < min_alpha:
            continue
        part, stack = [], [start]
        seen[start] = 1
        while stack:
            i = stack.pop()
            part.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not seen[j] and alpha[nx, ny] >= min_alpha:
                    seen[j] = 1
                    stack.append(j)
        parts.append(part)
    return parts


def only(im: Image.Image, pixels: list[int]) -> Image.Image:
    """A copy of `im` keeping just these pixels (indexes as in components())."""
    w = im.size[0]
    mask = Image.new('L', im.size, 0)
    px = mask.load()
    for i in pixels:
        px[i % w, i // w] = 255
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def drop_strays(im: Image.Image) -> Image.Image:
    """Drop what an automatic cut-out leaves around a sprite: shapes touching the picture's edge
    (slivers of the neighbouring sprite) and specks. The sprite itself and anything drawn apart
    from it inside the picture, like a contact shadow, are kept. Run before trim()."""
    im = im.convert('RGBA')
    w, h = im.size
    parts = components(im)
    biggest = max(map(len, parts), default=0)
    touches_edge = lambda part: any(i % w in (0, w - 1) or i // w in (0, h - 1) for i in part)
    return only(im, [i for part in parts if len(part) == biggest or (len(part) >= biggest * 0.005 and not touches_edge(part)) for i in part])


def seat_shadows(im: Image.Image) -> Image.Image:
    """Move contact shadows exported with a gap under a sprite up to its feet: each shape drawn
    entirely below the sprite is raised so its middle sits on the sprite's bottom edge, and drawn
    behind it. Run after drop_strays()."""
    im = im.convert('RGBA')
    w = im.size[0]
    parts = sorted(components(im), key=len, reverse=True)
    if len(parts) < 2:
        return im
    feet = max(i // w for i in parts[0])
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    rest = list(parts[0])
    for part in parts[1:]:
        top, bottom = min(i // w for i in part), max(i // w for i in part)
        if top <= feet:  # not under the sprite: leave it where it is
            rest += part
            continue
        out.alpha_composite(only(im, part), (0, feet - (top + bottom) // 2))
    out.alpha_composite(only(im, rest))
    return out


def add_shadow(im: Image.Image, feet: bool = False) -> Image.Image:
    """Draw a contact shadow under a trimmed sprite, in the style of the furniture pack: the same
    dark purple in stepped rings (darkest in the middle), a flat ellipse centred on the sprite's
    bottom edge and drawn behind it. The canvas grows to fit what shows below.

    `feet`: centre it on the lowest row the piece spans most of its width (a desk's feet) rather
    than its lowest pixel, so smaller bits that reach lower (a stool in front) stand in it too."""
    im = im.convert('RGBA')
    w, h = im.size
    sw, sh = round(w * 0.9), max(4, round(min(w * 0.16, h * 0.14)))  # wide pieces stay flat
    cx, cy = w / 2, h - 1
    if feet:
        alpha = im.split()[3]
        for y in range(h - 1, -1, -1):
            box = alpha.crop((0, y, w, y + 1)).getbbox()
            if box and box[2] - box[0] >= w * 0.6:
                cy = y
                break
    out = Image.new('RGBA', (w, max(h, cy + sh // 2 + 1)), (0, 0, 0, 0))  # h + sh // 2 without feet
    shadow = Image.new('RGBA', out.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    for scale, a in ((1.0, 32), (0.82, 78), (0.62, 128), (0.42, 169)):
        rx, ry = sw * scale / 2, sh * scale / 2
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(52, 31, 79, a))
    out.alpha_composite(shadow)
    out.alpha_composite(im, (0, 0))
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
