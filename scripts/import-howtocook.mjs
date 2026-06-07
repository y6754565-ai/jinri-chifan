import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, sep } from "node:path";

const sourceRoot = process.argv[2] || "/private/tmp/how-to-cook";
const dishesRoot = join(sourceRoot, "dishes");
const outputPath = process.argv[3] || "public/recipes.json";

const categoryNames = {
  aquatic: "水产",
  breakfast: "早餐",
  condiment: "调味料",
  dessert: "甜品",
  drink: "饮品",
  meat_dish: "荤菜",
  "semi-finished": "半成品",
  soup: "汤羹",
  staple: "主食",
  vegetable_dish: "素菜"
};

const categoryImages = {
  aquatic: "/images/greens-soup.jpg",
  breakfast: "/recipes/chao-hua-dan.jpg",
  condiment: "/recipes/gan-guo-hua-cai.jpg",
  dessert: "/recipes/ji-dan-geng.jpg",
  drink: "/images/greens-soup.jpg",
  meat_dish: "/images/cucumber-pork.jpg",
  "semi-finished": "/images/cucumber-pork.jpg",
  soup: "/images/greens-soup.jpg",
  staple: "/recipes/xi-hong-shi-mian.jpg",
  vegetable_dish: "/images/smashed-cucumber.jpg"
};

const localImages = {
  "干锅花菜": "/recipes/gan-guo-hua-cai.jpg",
  "上汤娃娃菜": "/recipes/shang-tang-wa-wa-cai.jpg",
  "炒滑蛋": "/recipes/chao-hua-dan.jpg",
  "地三鲜": "/recipes/di-san-xian.jpg",
  "鸡蛋羹": "/recipes/ji-dan-geng.jpg",
  "烤茄子": "/recipes/kao-qie-zi.jpg",
  "菠菜炒鸡蛋": "/recipes/bo-cai-chao-dan.jpg",
  "白灼菜心": "/recipes/bai-zhuo-cai-xin.jpg",
  "糖拌西红柿": "/recipes/tang-ban-xi-hong-shi.jpg",
  "瘦肉土豆片": "/recipes/shou-rou-tu-dou.jpg",
  "青椒土豆炒肉": "/recipes/qing-jiao-tu-dou-rou.jpg",
  "西红柿鸡蛋挂面": "/recipes/xi-hong-shi-mian.jpg"
};

const seasoningWords = [
  "油", "食用油", "植物油", "猪油", "盐", "食盐", "糖", "白糖", "白砂糖", "冰糖",
  "生抽", "老抽", "酱油", "醋", "香醋", "料酒", "蚝油", "鸡精", "味精", "淀粉",
  "胡椒", "胡椒粉", "白胡椒", "黑胡椒", "香油", "芝麻油", "清水", "水", "开水",
  "豆瓣酱", "番茄酱", "甜面酱", "黄豆酱", "辣椒油", "火锅底料", "咖喱块",
  "锅", "炒锅", "平底锅", "电饭煲", "烤箱", "空气炸锅", "微波炉", "蒸锅",
  "碗", "盘", "刀", "筷子", "勺", "搅拌器", "保鲜膜", "锡纸",
  "葱", "小葱", "大葱", "香葱", "葱花", "姜", "生姜", "老姜", "姜片", "姜末",
  "蒜", "大蒜", "蒜头", "蒜瓣", "蒜末", "八角", "香叶", "桂皮", "花椒",
  "干辣椒", "小米椒", "小米辣", "香菜", "芝麻", "白芝麻", "黑芝麻",
  "五香粉", "十三香", "孜然粉", "咖喱粉", "泡打粉", "生粉", "水淀粉", "小料"
];

const exactAliases = new Map([
  ["番茄", "西红柿"], ["马铃薯", "土豆"], ["洋芋", "土豆"], ["鸡胸脯肉", "鸡肉"],
  ["鸡胸肉", "鸡肉"], ["鸡腿肉", "鸡肉"], ["手枪腿", "鸡肉"], ["猪瘦肉", "猪肉"],
  ["瘦肉", "猪肉"], ["肉末", "猪肉"], ["肉馅", "猪肉"], ["白豆腐", "豆腐"],
  ["猪肉末", "猪肉"], ["五花肉", "猪肉"], ["猪里脊", "猪肉"], ["里脊肉", "猪肉"],
  ["内酯豆腐", "豆腐"], ["老豆腐", "豆腐"], ["嫩豆腐", "豆腐"], ["青辣椒", "青椒"],
  ["尖椒", "青椒"], ["青茄子", "茄子"], ["紫茄子", "茄子"],
  ["二荆条", "青椒"], ["挂面", "面条"], ["冷饭", "米饭"], ["剩饭", "米饭"],
  ["娃娃菜", "白菜"], ["菜花", "花菜"], ["花椰菜", "花菜"], ["圣女果", "西红柿"]
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function stripMarkdown(value) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalIngredient(raw) {
  let value = stripMarkdown(raw)
    .replace(/^[-+*]\s*/, "")
    .replace(/^[\d.]+\s*/, "")
    .split("=")[0]
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[（(].*$/, "")
    .replace(/建议使用|推荐使用|适量|少许|若干|可选|备选|按需|依口味|根据口味/g, "")
    .replace(/[：:].*$/, "")
    .replace(/[0-9０-９].*$/, "")
    .trim();

  value = exactAliases.get(value) || value;
  if (!value || value.length > 12) return null;
  if (seasoningWords.some((word) => value === word || value.endsWith(`${word}等调料`))) return null;
  if (/^(注|原料|材料|配料|必须配料|可选配料)$/.test(value)) return null;
  if (/工具|容器|模具|机器|蒸笼|砧板|锅|盆|碗|盘|刀|铲|勺|筷|手套|密封袋|漏勺|笊篱|刷子|筛网|擀面杖|打蛋器|刮刀|秒表|定时器|锡纸|保鲜膜|烤箱|空气炸锅|微波炉|电饭煲/.test(value)) return null;
  if (/^(海盐|食用盐|粗盐|椒盐|蒸鱼豉油|藤椒油|菜籽油|花生油|橄榄油|麻油|奶油|黄油|无盐黄油|酥油|陈醋|白醋|米醋|黑醋|香醋|生抽酱油|韩式酱油|鱼露|芥末|黑胡椒粒|黑胡椒粉|白胡椒粉|青花椒|红油豆瓣酱|郫县豆瓣酱|蒜蓉酱|蛋黄酱|芝麻酱|玉米淀粉|红薯淀粉)$/.test(value)) return null;
  if (/°C|不要的器官|尽量|放得下|一个容量|品牌不限|比较方便|原教程|小心使用|必须|火候|发苦|发甜/.test(value)) return null;
  return value;
}

function extractIngredients(markdown) {
  const section = markdown.match(/## 必备原料和工具\s*([\s\S]*?)(?=\n## 计算)/)?.[1] || "";
  const requiredOnly = section.split(/\n### /)[0];
  const result = [];

  for (const line of requiredOnly.split("\n")) {
    if (!/^\s*[-*+]\s+/.test(line)) continue;
    const raw = stripMarkdown(line.replace(/^\s*[-*+]\s+/, ""))
      .replace(/[（(][^）)]*[）)]/g, "")
      .replace(/[（(].*$/, "");
    if (!raw || raw.includes("http")) continue;
    const parts = raw.split(/[、，,\/]|或者|或是|或|\s+or\s+/i).map(canonicalIngredient).filter(Boolean);
    for (const item of parts) {
      if (!result.includes(item)) result.push(item);
    }
  }
  return result.slice(0, 10);
}

function extractSteps(markdown) {
  const section = markdown.match(/## 操作\s*([\s\S]*?)(?=\n## 附加内容|\n## 备注|$)/)?.[1] || "";
  const steps = [];
  for (const line of section.split("\n")) {
    const match = line.match(/^\s*(?:\d+[.)、]|[-*+])\s*(.+)$/);
    if (!match) continue;
    const text = stripMarkdown(match[1]).replace(/[；;]$/, "。");
    if (text.length >= 4 && !steps.includes(text)) steps.push(text);
    if (steps.length === 8) break;
  }
  return steps;
}

function extractTime(markdown, category) {
  const hour = markdown.match(/(?:大约|约|需要|耗时)?\s*(\d+(?:\.\d+)?)\s*小时/);
  if (hour) return Math.max(5, Math.round(Number(hour[1]) * 60));
  const minute = markdown.match(/(?:大约|约|需要|耗时)?\s*(\d+)\s*分钟/);
  if (minute) return Math.max(5, Number(minute[1]));
  return category === "drink" ? 10 : category === "soup" ? 35 : category === "meat_dish" ? 40 : 25;
}

function extractDifficulty(markdown) {
  const stars = markdown.match(/预估烹饪难度[：:]\s*(★+)/)?.[1]?.length || 2;
  return stars <= 1 ? "超简单" : stars === 2 ? "简单" : stars === 3 ? "适中" : "进阶";
}

function extractDescription(markdown, title) {
  const afterTitle = markdown.replace(/^#[^\n]*\n+/, "");
  const paragraph = afterTitle.split(/\n\s*\n/).map(stripMarkdown).find((line) =>
    line && !line.startsWith("预估") && !line.startsWith("#")
  );
  if (!paragraph) return `${title}的家常做法`;
  return paragraph.length > 52 ? `${paragraph.slice(0, 51)}…` : paragraph;
}

function encodeRepoPath(path) {
  return path.split(sep).map(encodeURIComponent).join("/");
}

async function findImage(markdownPath, markdown, name, category, allFiles) {
  if (localImages[name]) return { url: localImages[name], exact: true, source: "project" };

  const markdownImage = markdown.match(/!\[[^\]]*]\((?!https?:)([^)]+\.(?:jpg|jpeg|png|webp))\)/i)?.[1];
  let imagePath = markdownImage ? join(dirname(markdownPath), decodeURIComponent(markdownImage)) : null;

  if (!imagePath || !allFiles.includes(imagePath)) {
    imagePath = allFiles.find((file) =>
      dirname(file) === dirname(markdownPath) && /\.(jpe?g|png|webp)$/i.test(file)
    );
  }

  if (!imagePath) {
    return {
      url: categoryImages[category] || "/images/stir-fry.svg",
      exact: false,
      source: "fallback"
    };
  }
  const repoPath = relative(sourceRoot, imagePath);
  return {
    url: `https://media.githubusercontent.com/media/Anduin2017/HowToCook/master/${encodeRepoPath(repoPath)}`,
    exact: true,
    source: `https://github.com/Anduin2017/HowToCook/blob/master/${encodeRepoPath(repoPath)}`
  };
}

const allFiles = await walk(dishesRoot);
const markdownFiles = allFiles
  .filter((file) => extname(file) === ".md" && !file.includes(`${sep}template${sep}`))
  .sort((a, b) => a.localeCompare(b, "zh-CN"));

const recipes = [];
for (const markdownPath of markdownFiles) {
  const markdown = await readFile(markdownPath, "utf8");
  const category = relative(dishesRoot, markdownPath).split(sep)[0];
  const title = stripMarkdown(markdown.match(/^#\s+(.+?)(?:的做法)?\s*$/m)?.[1] || basename(markdownPath, ".md"));
  const ingredients = extractIngredients(markdown);
  const steps = extractSteps(markdown);
  if (!title || ingredients.length === 0 || steps.length === 0) continue;

  const image = await findImage(markdownPath, markdown, title, category, allFiles);
  recipes.push({
    name: title,
    subtitle: extractDescription(markdown, title),
    category: categoryNames[category] || category,
    time: extractTime(markdown, category),
    difficulty: extractDifficulty(markdown),
    image: image.url,
    imageExact: image.exact,
    imageSource: image.source,
    ingredients,
    extras: [],
    steps
  });
}

await writeFile(outputPath, `${JSON.stringify(recipes, null, 2)}\n`);
console.log(JSON.stringify({
  sourceMarkdown: markdownFiles.length,
  importedRecipes: recipes.length,
  exactImages: recipes.filter((recipe) => recipe.imageExact).length,
  outputPath
}, null, 2));
