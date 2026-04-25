const gamePk = "824851";

const feedUrl = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;

async function run() {
const res = await fetch(feedUrl);
const data = await res.json();

console.log("Top-level keys:", Object.keys(data));
console.log("Live data keys:", Object.keys(data.liveData));
console.log("Boxscore keys:", Object.keys(data.liveData.boxscore));
console.log("Team keys:", Object.keys(data.liveData.boxscore.teams));

console.log(JSON.stringify(data.liveData.boxscore.teams.away.players, null, 2));
}

run();