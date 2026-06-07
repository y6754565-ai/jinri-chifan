import { readFile, writeFile } from "node:fs/promises";

const recipesPath = "public/recipes.json";
const recipes = JSON.parse(await readFile(recipesPath, "utf8"));

const seasoningRules = [
  ["食用油", /食用油|植物油|菜籽油|花生油|橄榄油|玉米油|色拉油|油温|热油|锅中.{0,4}油|放入.{0,4}油/],
  ["盐", /食盐|海盐|粗盐|[^椒]盐(?!水)|加盐|盐适量/],
  ["白糖", /白砂糖|绵白糖|冰糖|白糖|糖色/],
  ["生抽", /生抽|生抽酱油/],
  ["老抽", /老抽/],
  ["醋", /陈醋|香醋|米醋|白醋|黑醋|[^油]醋/],
  ["料酒", /料酒|黄酒|花雕酒/],
  ["蚝油", /蚝油/],
  ["淀粉", /玉米淀粉|红薯淀粉|土豆淀粉|水淀粉|生粉|干淀粉|淀粉/],
  ["葱", /小葱|香葱|大葱|葱白|葱花|葱段|葱丝|葱末|葱姜/],
  ["姜", /生姜|老姜|姜片|姜丝|姜末|葱姜/],
  ["蒜", /大蒜|蒜头|蒜瓣|蒜末|蒜蓉|姜蒜/],
  ["干辣椒", /干辣椒|辣椒段|辣椒面|辣椒粉|红辣椒粉/],
  ["花椒", /青花椒|红花椒|花椒粒|花椒粉|花椒/],
  ["豆瓣酱", /郫县豆瓣酱|红油豆瓣酱|豆瓣酱/],
  ["咖喱", /咖喱块|咖喱粉|咖喱酱|咖喱/],
  ["香油", /芝麻油|麻油|香油/],
  ["鸡精", /鸡精|味精/],
  ["胡椒粉", /黑胡椒粒|黑胡椒粉|白胡椒粉|胡椒粉|黑胡椒|白胡椒/],
  ["孜然", /孜然粒|孜然粉|孜然/],
  ["芝麻", /白芝麻|黑芝麻|熟芝麻|芝麻/],
  ["番茄酱", /番茄沙司|番茄酱/],
  ["甜面酱", /甜面酱/],
  ["黄豆酱", /黄豆酱/],
  ["芝麻酱", /芝麻酱/],
  ["五香粉", /五香粉|十三香/],
  ["八角", /八角|大料/],
  ["桂皮", /桂皮/],
  ["香叶", /香叶/],
  ["泡打粉", /泡打粉/],
  ["黄油", /无盐黄油|黄油/],
  ["蛋黄酱", /蛋黄酱|沙拉酱/],
  ["鱼露", /鱼露/],
  ["芥末", /芥末/]
];

for (const recipe of recipes) {
  const text = [recipe.subtitle, ...(recipe.steps || [])].join("\n");
  recipe.seasonings = seasoningRules
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);

const counts = new Map();
for (const recipe of recipes) {
  for (const seasoning of recipe.seasonings) {
    counts.set(seasoning, (counts.get(seasoning) || 0) + 1);
  }
}
console.log([...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name}\t${count}`).join("\n"));
