import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const recipesPath = path.join(root, "public", "recipes.json");
const imageDir = path.join(root, "public", "recipe-images");
const excludedCategories = new Set(["饮品", "调味料", "半成品"]);
const resetImported = process.argv.includes("--reset");
const limitArg = process.argv.find((value) => /^\d+$/.test(value));
const limit = Number(limitArg || 20);
const fallbackImages = {
  水产: "/images/greens-soup.jpg",
  早餐: "/recipes/chao-hua-dan.jpg",
  甜品: "/recipes/ji-dan-geng.jpg",
  荤菜: "/images/cucumber-pork.jpg",
  汤羹: "/images/greens-soup.jpg",
  主食: "/recipes/xi-hong-shi-mian.jpg",
  素菜: "/images/smashed-cucumber.jpg",
};
const rejectedMatches = new Set(["黄油鸡", "意式烤鸡", "番茄红酱"]);
const searchAliases = {
  韩国麻药鸡蛋: "韩式麻药鸡蛋",
  煮泡面加蛋: "泡面加蛋",
  炒茄子: "家常炒茄子",
  雷椒皮蛋: "擂椒皮蛋",
  西红柿炒鸡蛋: "番茄炒蛋",
};

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function normalizeTitle(value) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, "")
    .replace(/[\s·•，,。.!！?？、（）()【】[\]《》<>“”"'‘’：:；;]/g, "")
    .toLowerCase();
}

function slugFor(recipe) {
  const readable = String(recipe.id || "")
    .replace(/^dish-/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (readable) return readable;
  return createHash("sha1").update(recipe.name).digest("hex").slice(0, 12);
}

function exactResult(html, dishName, alias = "") {
  const targets = [dishName, alias].filter(Boolean).map(normalizeTitle);
  const candidates = [];
  const cards = html.matchAll(
    /<a href="(\/recipe\/\d+\/)"[^>]*>[\s\S]*?<div class="cover[^"]*"[\s\S]*?<img[^>]+data-src="([^"]+)"[^>]+alt="([^"]+)"[\s\S]*?<\/div>/g,
  );

  for (const match of cards) {
    candidates.push({
      pageUrl: `https://www.xiachufang.com${match[1]}`,
      imageUrl: decodeHtml(match[2]).replace(/\?.*$/, ""),
      title: decodeHtml(match[3]),
      normalizedTitle: normalizeTitle(match[3]),
    });
  }
  const exact = candidates.find((candidate) =>
    targets.includes(candidate.normalizedTitle),
  );
  if (exact) return exact;
  return (
    candidates.find((candidate) =>
      targets.some(
        (target) =>
          target.length >= 3 && candidate.normalizedTitle.includes(target),
      ),
    ) || null
  );
}

async function fetchChecked(url) {
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "zh-CN,zh;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

const recipes = JSON.parse(await readFile(recipesPath, "utf8"));
for (const recipe of recipes) {
  if (!rejectedMatches.has(recipe.name)) continue;
  recipe.image = fallbackImages[recipe.category] || "/images/stir-fry.svg";
  recipe.imageExact = false;
  recipe.imageSource = "Rejected after visual recipe comparison";
}
if (resetImported) {
  for (const recipe of recipes) {
    if (!recipe.imageSource?.startsWith("下厨房：")) continue;
    recipe.image = fallbackImages[recipe.category] || "/images/stir-fry.svg";
    recipe.imageExact = false;
    recipe.imageSource = "fallback";
  }
}
const missing = recipes
  .filter(
    (recipe) =>
      !excludedCategories.has(recipe.category) &&
      !rejectedMatches.has(recipe.name) &&
      !recipe.imageExact,
  )
  .slice(0, limit);

await mkdir(imageDir, { recursive: true });
let filled = 0;

for (const [index, recipe] of missing.entries()) {
  try {
    const alias = searchAliases[recipe.name] || "";
    const searchName = alias || recipe.name;
    const searchUrl = `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(searchName)}`;
    const html = await (await fetchChecked(searchUrl)).text();
    const result = exactResult(html, recipe.name, alias);
    if (!result) {
      console.log(`[${index + 1}/${missing.length}] MISS ${recipe.name}`);
      continue;
    }

    const imageResponse = await fetchChecked(result.imageUrl);
    const contentType = imageResponse.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`unexpected content type: ${contentType}`);
    }

    const extension = contentType.includes("png") ? "png" : "jpg";
    const filename = `xiachufang-${slugFor(recipe)}.${extension}`;
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length < 10_000) throw new Error(`image too small: ${bytes.length}`);

    await writeFile(path.join(imageDir, filename), bytes);
    recipe.image = `/recipe-images/${filename}`;
    recipe.imageExact = true;
    recipe.imageSource = `下厨房：${result.pageUrl}`;
    filled += 1;
    console.log(`[${index + 1}/${missing.length}] OK ${recipe.name} <- ${result.title}`);
  } catch (error) {
    console.log(`[${index + 1}/${missing.length}] ERROR ${recipe.name}: ${error.message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
}

await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
console.log(`Filled ${filled}/${missing.length}.`);
