import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const sourceRoot = process.argv[2];
if (!sourceRoot) {
  console.error("Usage: node scripts/pack-cot-fallback.mjs <extracted-cftc-directory>");
  process.exit(2);
}

const files = [];
for (const directory of fs.readdirSync(sourceRoot)) {
  const directoryPath = path.join(sourceRoot, directory);
  if (!fs.statSync(directoryPath).isDirectory()) continue;
  for (const name of fs.readdirSync(directoryPath)) {
    if (name.endsWith(".txt")) files.push(path.join(directoryPath, name));
  }
}

const codes = new Set([
  "099741",
  "096742",
  "097741",
  "232741",
  "090741",
  "092741",
  "112741",
  "095741",
  "098662",
  "088691",
  "084691",
  "085692",
  "067651",
  "023651",
  "13874A",
  "209742",
  "043602",
  "020601",
  "133741",
]);

const fields = [
  "CFTC Contract Market Code",
  "As of Date in Form YYYY-MM-DD",
  "Open Interest (All)",
  "Noncommercial Positions-Long (All)",
  "Noncommercial Positions-Short (All)",
  "Noncommercial Positions-Spreading (All)",
  "Commercial Positions-Long (All)",
  "Commercial Positions-Short (All)",
  "Nonreportable Positions-Long (All)",
  "Nonreportable Positions-Short (All)",
  "Change in Open Interest (All)",
  "Change in Noncommercial-Long (All)",
  "Change in Noncommercial-Short (All)",
  "Change in Commercial-Long (All)",
  "Change in Commercial-Short (All)",
  "Change in Nonreportable-Long (All)",
  "Change in Nonreportable-Short (All)",
];

const keys = [
  "cftc_contract_market_code",
  "report_date_as_yyyy_mm_dd",
  "open_interest_all",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
  "noncomm_postions_spread_all",
  "comm_positions_long_all",
  "comm_positions_short_all",
  "nonrept_positions_long_all",
  "nonrept_positions_short_all",
  "change_in_open_interest_all",
  "change_in_noncomm_long_all",
  "change_in_noncomm_short_all",
  "change_in_comm_long_all",
  "change_in_comm_short_all",
  "change_in_nonrept_long_all",
  "change_in_nonrept_short_all",
];

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function numberValue(value) {
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : 0;
}

const rows = [];
const seen = new Set();
for (const file of files) {
  const input = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let indexes;
  for await (const line of input) {
    const values = parseCsvLine(line);
    if (!indexes) {
      const header = new Map(values.map((value, index) => [value.trim(), index]));
      indexes = fields.map((field) => header.get(field));
      continue;
    }
    const code = (values[indexes[0]] ?? "").trim();
    if (!codes.has(code)) continue;
    const date = (values[indexes[1]] ?? "").trim();
    const id = `${code}|${date}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push([code, date, ...indexes.slice(2).map((index) => numberValue(values[index] ?? ""))]);
  }
}

rows.sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]));
const target = path.resolve("src/data/cot-fallback.json");
fs.writeFileSync(target, JSON.stringify({ keys, rows }));
console.log(
  JSON.stringify({
    files: files.length,
    rows: rows.length,
    earliest: rows[0]?.[1],
    latest: rows.at(-1)?.[1],
    sizeKB: Math.round(fs.statSync(target).size / 102.4) / 10,
  }),
);