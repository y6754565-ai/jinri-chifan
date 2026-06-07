import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const recipesPath = process.argv[2] || "public/recipes.json";
const outputDir = process.argv[3] || "public/recipe-images";
const recipes = JSON.parse(await readFile(recipesPath, "utf8"));
const excludedCategories = new Set(["饮品", "调味料", "半成品"]);
const targets = recipes.filter((recipe) => !excludedCategories.has(recipe.category) && !recipe.imageExact);

await mkdir(outputDir, { recursive: true });

const htmlDecode = (value) => value
  .replaceAll("&quot;", '"')
  .replaceAll("&amp;", "&")
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchImages(name) {
  const query = encodeURIComponent(`${name} 菜 成品 实拍`);
  const response = await fetch(`https://www.bing.com/images/search?q=${query}&qft=+filterui:photo-photo+filterui:imagesize-medium`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9"
    }
  });
  if (!response.ok) throw new Error(`search ${response.status}`);
  const html = await response.text();
  const candidates = [];
  const pattern = /class="iusc"[^>]*\sm="([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    try {
      const data = JSON.parse(htmlDecode(match[1]));
      if (data.murl) candidates.push({ imageUrl: data.murl, sourceUrl: data.purl || data.murl });
      if (data.turl) candidates.push({ imageUrl: data.turl, sourceUrl: data.purl || data.murl || data.turl });
    } catch {
      // Skip malformed search metadata.
    }
    if (candidates.length >= 20) break;
  }
  return candidates;
}

async function downloadCandidate(candidate) {
  const response = await fetch(candidate.imageUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!response.ok) return null;
  const type = (response.headers.get("content-type") || "").split(";")[0];
  const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
  const extension = extensions[type] || extname(new URL(response.url).pathname).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 15000 || bytes.length > 8_000_000) return null;
  return { bytes, extension: extension === ".jpeg" ? ".jpg" : extension };
}

async function fillRecipe(recipe, targetIndex) {
  const candidates = await searchImages(recipe.name);
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      const download = await downloadCandidate(candidates[index]);
      if (!download) continue;
      const filename = `dish-${String(targetIndex + 1).padStart(3, "0")}${download.extension}`;
      await writeFile(join(outputDir, filename), download.bytes);
      recipe.image = `/recipe-images/${filename}`;
      recipe.imageExact = true;
      recipe.imageSource = candidates[index].sourceUrl;
      recipe.imageQuery = `${recipe.name} 菜 成品 实拍`;
      return { ok: true, filename, candidate: index + 1 };
    } catch {
      // Try the next result.
    }
  }
  return { ok: false };
}

let completed = 0;
let failed = 0;
const concurrency = 3;
let cursor = 0;

async function worker() {
  while (cursor < targets.length) {
    const index = cursor;
    cursor += 1;
    const recipe = targets[index];
    try {
      const result = await fillRecipe(recipe, index);
      if (result.ok) {
        completed += 1;
        console.log(`[${completed + failed}/${targets.length}] OK ${recipe.name} -> ${result.filename}`);
      } else {
        failed += 1;
        console.log(`[${completed + failed}/${targets.length}] MISS ${recipe.name}`);
      }
    } catch (error) {
      failed += 1;
      console.log(`[${completed + failed}/${targets.length}] ERROR ${recipe.name}: ${error.message}`);
    }
    if ((completed + failed) % 10 === 0) {
      await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
    }
    await sleep(250);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
console.log(JSON.stringify({ targets: targets.length, completed, failed }, null, 2));
