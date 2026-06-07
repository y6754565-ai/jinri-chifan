import json
import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "work" / "image-audit"
OUTPUT.mkdir(parents=True, exist_ok=True)

with (PUBLIC / "recipes.json").open(encoding="utf-8") as recipe_file:
    recipes = [
        recipe for recipe in json.load(recipe_file)
        if recipe.get("image", "").startswith("/recipe-images/")
    ]

font_paths = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
]
font_path = next((path for path in font_paths if os.path.exists(path)), None)
font = ImageFont.truetype(font_path, 18) if font_path else ImageFont.load_default()

for sheet_index in range(math.ceil(len(recipes) / 20)):
    group = recipes[sheet_index * 20:(sheet_index + 1) * 20]
    rows = math.ceil(len(group) / 4)
    sheet = Image.new("RGB", (1200, rows * 230), "#f5f2e9")
    draw = ImageDraw.Draw(sheet)

    for index, recipe in enumerate(group):
        x = (index % 4) * 300 + 10
        y = (index // 4) * 230 + 10
        image_path = PUBLIC / recipe["image"].lstrip("/")
        with Image.open(image_path) as source:
            source = source.convert("RGB")
            source.thumbnail((280, 175))
            tile = Image.new("RGB", (280, 175), "#e7e1d3")
            tile.paste(source, ((280 - source.width) // 2, (175 - source.height) // 2))
            sheet.paste(tile, (x, y))
        draw.rectangle((x, y + 175, x + 280, y + 215), fill="#fffdf8")
        draw.text((x + 8, y + 184), recipe["name"], fill="#18221b", font=font)

    sheet.save(OUTPUT / f"sheet-{sheet_index + 1:02}.jpg", quality=85)

print(json.dumps({"recipes": len(recipes), "sheets": math.ceil(len(recipes) / 20)}))
