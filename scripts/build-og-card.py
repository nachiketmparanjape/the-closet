#!/usr/bin/env python3
# PC-61 follow-up (2026-11-21): build the 1200x630 link-preview
# card (public/og-card.png). Warm Editorial identity (DESIGN.md
# §10): espresso ground, ivory type, brass accents. The brand
# fonts are the app's own, served from public/fonts/ (PC-62
# externalized them out of the HTML shell). Run:
#   python3 scripts/build-og-card.py
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FONTS = os.path.join(ROOT, "public", "fonts")
OUT = os.path.join(ROOT, "public", "og-card.png")

W, H = 1200, 630
ESPRESSO = (22, 18, 13)        # #16120d — dark theme ground
GHOST = (38, 30, 20)           # watermark tone, a step above ground
IVORY = (253, 250, 241)        # #fdfaf1
SOFT = (233, 223, 200)         # #e9dfc8
BRASS = (168, 124, 28)         # #a87c1c
BRASS_LT = (217, 179, 106)     # brass lightened for small text on dark


def spaced(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def main():
    serif600 = os.path.join(FONTS, "ClosetSerif-600.ttf")
    serif500 = os.path.join(FONTS, "ClosetSerif-500.ttf")
    sans400 = os.path.join(FONTS, "ClosetSans-400.ttf")
    sans600 = os.path.join(FONTS, "ClosetSans-600.ttf")

    img = Image.new("RGB", (W, H), ESPRESSO)
    d = ImageDraw.Draw(img)

    # Ghost serif C watermark, right side, cropped by the edge.
    d.text((880, 90), "C", font=ImageFont.truetype(serif500, 520), fill=GHOST)

    # Hairline brass frame, inset.
    d.rectangle([28, 28, W - 28, H - 28], outline=(74, 60, 34), width=2)

    M = 96  # left margin

    # Eyebrow: small brass caps.
    spaced(d, (M, 118), "YOUR WARDROBE, STYLED",
           ImageFont.truetype(sans600, 27), BRASS_LT, 7)

    # Wordmark.
    d.text((M - 6, 168), "Closet", font=ImageFont.truetype(serif600, 168), fill=IVORY)

    # Brass rule.
    d.rectangle([M, 386, M + 132, 391], fill=BRASS)

    # One-liner (PRODUCT.md), two lines.
    line_font = ImageFont.truetype(sans400, 43)
    d.text((M, 424), "An AI wardrobe stylist: catalogue your", font=line_font, fill=SOFT)
    d.text((M, 480), "clothes, get outfit picks.", font=line_font, fill=SOFT)

    # URL, bottom, letterspaced brass.
    spaced(d, (M, 556), "CLOSET-404E9.WEB.APP",
           ImageFont.truetype(sans600, 26), BRASS_LT, 5)

    img.save(OUT)
    print("saved", OUT, img.size)


if __name__ == "__main__":
    main()
