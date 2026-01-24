const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "../data/gameFiles/background/background.json");
const outputPath = path.join(__dirname, "../data/gameFiles/background/background.camel.json");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function toCamelCase(str) {
  return str
    .replace(/[-_]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ""))
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

function shouldCamelizeString(str) {
  return typeof str === "string" &&
    !str.includes(" ") &&
    (str.includes("_") || str.includes("-"));
}

function camelize(value) {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[toCamelCase(key)] = camelize(val);
      return acc;
    }, {});
  }

  if (shouldCamelizeString(value)) {
    return toCamelCase(value);
  }

  return value;
}

const output = camelize(data);

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

console.log("✓ Backgrounds converted to camelCase");
console.log("→ Output:", outputPath);
