"""Draws the app icon, Android adaptive icon layers and splash image into assets/images/.

Run from the project root:  python3 tools/make_icons.py
"""

from PIL import Image, ImageDraw, ImageFont

OUT = "assets/images"
SIZE = 1024
TOP = (124, 108, 255)     # #7c6cff
BOTTOM = (59, 47, 201)    # #3b2fc9
GOLD = (251, 191, 36)     # #fbbf24
INK = (31, 26, 92)        # #1f1a5c
FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
SS = 4  # supersampling for smooth edges


def gradient(size):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    return img


def draw_mark(size, scale, color=(255, 255, 255), badge=True):
    """Bluetooth rune (+ optional gold "A+" badge), centred, on a transparent canvas."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = big * scale
    cx, cy = big * 0.47, big * 0.5
    pts = [(-0.17, 0.14), (0.17, -0.16), (0.0, -0.31), (0.0, 0.31), (0.17, 0.16), (-0.17, -0.14)]
    d.line([(cx + x * s, cy + y * s) for x, y in pts], fill=color, width=round(0.065 * s), joint="curve")
    if badge:
        r = 0.16 * s
        bx, by = cx + 0.30 * s, cy + 0.27 * s
        d.ellipse([bx - r * 1.12, by - r * 1.12, bx + r * 1.12, by + r * 1.12], fill=(255, 255, 255, 255))
        d.ellipse([bx - r, by - r, bx + r, by + r], fill=GOLD)
        font = ImageFont.truetype(FONT, round(r * 1.05))
        d.text((bx, by + r * 0.04), "A+", font=font, fill=INK, anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def main():
    bg = gradient(SIZE)

    # iOS / legacy icon: opaque, iOS rounds the corners itself
    icon = bg.copy().convert("RGBA")
    icon.alpha_composite(draw_mark(SIZE, 1.0))
    icon.convert("RGB").save(f"{OUT}/icon.png")

    # Android adaptive icon: the launcher crops to ~66% of the layer, so keep the mark small
    bg.save(f"{OUT}/android-icon-background.png")
    draw_mark(SIZE, 0.62).save(f"{OUT}/android-icon-foreground.png")
    draw_mark(SIZE, 0.62, badge=False).save(f"{OUT}/android-icon-monochrome.png")

    # Splash image (shown on a solid background colour set in app.json)
    draw_mark(512, 1.0).save(f"{OUT}/splash-icon.png")
    icon.resize((48, 48), Image.LANCZOS).save(f"{OUT}/favicon.png")


if __name__ == "__main__":
    main()
