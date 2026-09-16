from PIL import Image
from pathlib import Path

src = Path(
    r"C:\Users\Admin\.cursor\projects\d-BookMyBota\assets"
    r"\c__Users_Admin_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"b4bbf942159466661979d0476a3db5fd_images_image-f52dc41d-8bde-4311-a1d8-8f587f3ce72b.png"
)
img = Image.open(src.convert("RGBA") if False else src)
w, h = img.size
print("source", w, h)
out = Path(r"d:\BookMyBota\frontend\public\images\events\explore")
out.mkdir(parents=True, exist_ok=True)

# Tuned for 1024x399 explore screenshot: title ~y0-48, row1 cards, row2 cards
# Empirically: content starts ~y=52, row1 ends ~y=250, row2 ~y=262-390
row1 = (52, 248)
row2 = (262, 392)

names_row1 = [
    "music",
    "nightlife",
    "sports",
    "performances",
    "fests-fairs",
    "food-drinks",
    "social-mixers",
    "screenings",
]
names_row2 = ["fitness", "conferences", "expos"]


def crop_row(y0, y1, names, count_in_full_row=8):
    # cards span nearly full width with small side padding
    pad = 18
    gap = 10
    usable = w - pad * 2
    card_w = (usable - gap * (count_in_full_row - 1)) // count_in_full_row
    for i, name in enumerate(names):
        x0 = pad + i * (card_w + gap)
        x1 = x0 + card_w
        tile = img.crop((x0, y0, min(x1, w - pad), y1))
        # trim bottom bleed if next row peeks
        tile.save(out / f"{name}.png")
        print(name, tile.size)


crop_row(*row1, names_row1, 8)
crop_row(*row2, names_row2, 8)
print("done")
