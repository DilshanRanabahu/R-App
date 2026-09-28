"""Generate R App icons (DESIGN.md colors). Run: python scripts/make-icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

PRIMARY = (47, 111, 235, 255)  # colors.primary #2F6FEB
BACKGROUND = (234, 241, 254, 255)  # colors.primaryBg #EAF1FE
WHITE = (255, 255, 255, 255)
SIZE = 1024
SCALE = 4  # draw large, downsample for smooth edges
ASSETS = Path(__file__).resolve().parent.parent / "assets"


def glyph(draw: ImageDraw.ImageDraw, color, hole, scale: float, cx: float, cy: float) -> None:
    """Router with two antennas and a Wi-Fi signal, centred on (cx, cy)."""

    def p(x: float, y: float) -> tuple[float, float]:
        return (cx + x * scale * SCALE, cy + y * scale * SCALE)

    def r(v: float) -> float:
        return v * scale * SCALE

    # Wi-Fi arcs + dot
    for radius in (70, 130):
        w = r(26)
        box = [*p(-radius, -radius - 50), *p(radius, radius - 50)]
        draw.arc(box, start=225, end=315, fill=color, width=int(w))
    dot = 20
    draw.ellipse([*p(-dot, -50 - dot), *p(dot, -50 + dot)], fill=color)

    # Antennas
    for x in (-132, 132):
        draw.rounded_rectangle([*p(x - 11, 20), *p(x + 11, 110)], radius=r(11), fill=color)

    # Body
    draw.rounded_rectangle([*p(-180, 90), *p(180, 230)], radius=r(36), fill=color)

    # Status lights
    for x in (-112, -62):
        draw.ellipse([*p(x - 14, 160 - 14), *p(x + 14, 160 + 14)], fill=hole)
    draw.rounded_rectangle([*p(10, 150), *p(130, 170)], radius=r(10), fill=hole)


def render(bg, color, hole, scale: float) -> Image.Image:
    big = SIZE * SCALE
    img = Image.new("RGBA", (big, big), bg)
    # Glyph spans y -230..230 around its origin; centre it on the canvas.
    glyph(ImageDraw.Draw(img), color, hole, scale, big / 2, big / 2)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    clear = (0, 0, 0, 0)
    # Adaptive foreground: keep inside the 66% safe zone.
    render(clear, PRIMARY, BACKGROUND, 0.95).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (SIZE, SIZE), BACKGROUND).save(ASSETS / "android-icon-background.png")
    # Monochrome (themed icons): Android tints the alpha channel.
    render(clear, WHITE, clear, 0.95).save(ASSETS / "android-icon-monochrome.png")
    # Legacy / store icon: full square, larger glyph.
    render(BACKGROUND, PRIMARY, BACKGROUND, 1.35).save(ASSETS / "icon.png")
    render(clear, PRIMARY, BACKGROUND, 1.2).save(ASSETS / "splash-icon.png")
    render(BACKGROUND, PRIMARY, BACKGROUND, 1.35).resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
