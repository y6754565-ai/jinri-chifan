import { readFile, writeFile, unlink } from "node:fs/promises";

const recipesPath = "public/recipes.json";
const recipes = JSON.parse(await readFile(recipesPath, "utf8"));

const verified = {
  煎饺: {
    image: "/recipe-images/dish-jian-jiao.jpg",
    imageSource: "https://commons.wikimedia.org/wiki/File:Chinese_vegetable_dumpling_potsticker.jpg"
  },
  炒年糕: {
    image: "/recipe-images/dish-chao-nian-gao.jpg",
    imageSource: "https://commons.wikimedia.org/wiki/File:Stir-fried_rice_cakes_with_ground_pork,_gochujang,_and_gailan.jpg"
  },
  南派红烧肉: {
    image: "https://media.githubusercontent.com/media/Anduin2017/HowToCook/master/dishes/meat_dish/%E7%BA%A2%E7%83%A7%E8%82%89/001.jpg",
    imageSource: "https://github.com/Anduin2017/HowToCook/blob/master/dishes/meat_dish/%E7%BA%A2%E7%83%A7%E8%82%89/001.jpg"
  },
  蒸箱鸡蛋羹: {
    image: "https://media.githubusercontent.com/media/Anduin2017/HowToCook/master/dishes/vegetable_dish/%E9%B8%A1%E8%9B%8B%E7%BE%B9/%E9%B8%A1%E8%9B%8B%E7%BE%B9.jpg",
    imageSource: "https://github.com/Anduin2017/HowToCook/blob/master/dishes/vegetable_dish/%E9%B8%A1%E8%9B%8B%E7%BE%B9/%E9%B8%A1%E8%9B%8B%E7%BE%B9.jpg"
  }
};

for (const recipe of recipes) {
  if (!verified[recipe.name]) continue;
  Object.assign(recipe, verified[recipe.name], {
    imageExact: true,
    imageQuery: "Wikimedia Commons verified image"
  });
}

const fern = recipes.find((recipe) => recipe.name === "酸辣蕨根粉");
if (fern) {
  fern.imageExact = false;
  fern.imageSource = "No verified finished-dish image available";
}

const stovetopRice = recipes.find((recipe) => recipe.name === "煮锅蒸米饭");
if (stovetopRice) {
  stovetopRice.imageExact = false;
  stovetopRice.imageSource = "Excluded: source repository has no unique second finished-dish image";
}

await unlink("public/recipe-images/dish-jue-gen-fen.jpg").catch(() => {});
await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
