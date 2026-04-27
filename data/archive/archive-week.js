const fs = require("fs");
const path = require("path");


const WEEK_NUMBER = 5;


const inputPath = path.join(__dirname, "..", "weekly-leaders.json");
const outputDir = __dirname;
const outputPath = path.join(outputDir, `week-${WEEK_NUMBER}.json`);


if (!fs.existsSync(inputPath)) {
  console.error(`Could not find input file: ${inputPath}`);
  process.exit(1);
}


const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));


const archive = {
  week: WEEK_NUMBER,
  archivedAt: new Date().toISOString(),
  scoringPeriod: data.scoringPeriod,
  counts: data.counts,
  overallLeaders: data.overallLeaders || [],
  hitterLeaders: data.hitterLeaders || [],
  pitcherLeaders: data.pitcherLeaders || []
};


fs.writeFileSync(outputPath, JSON.stringify(archive, null, 2));


console.log(`Archived Week ${WEEK_NUMBER}`);
console.log(`Output: ${outputPath}`);

