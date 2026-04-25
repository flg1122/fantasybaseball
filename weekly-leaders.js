const fs = require("fs");
const path = require("path");

function num(value) {
  return Number(value || 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatDateET(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getCurrentWeekDatesET() {
  const now = new Date();

  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).formatToParts(now);

  const weekday = etParts.find((p) => p.type === "weekday").value;

  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const currentDay = dayMap[weekday];
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);

  const dates = [];

  for (let i = 0; i <= daysSinceMonday; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDateET(d));
  }

  return dates;
}

function scoreBatting(b = {}) {
  return (
    num(b.baseOnBalls) * 3 +
    num(b.triples) * 5.7 +
    num(b.doubles) * 2.9 +
    num(b.atBats) * -1 +
    num(b.caughtStealing) * -2.8 +
    num(b.hits) * 5.6 +
    num(b.hitByPitch) * 3 +
    num(b.homeRuns) * 9.4 +
    num(b.stolenBases) * 1.9
  );
}

function scorePitching(p = {}) {
  const pointsPerOut = 7.4 / 3;

  return (
    num(p.baseOnBalls) * -3 +
    num(p.hits) * -2.6 +
    num(p.hitBatsmen) * -3 +
    num(p.holds) * 4 +
    num(p.homeRuns) * -12.3 +
    num(p.outs) * pointsPerOut +
    num(p.strikeOuts) * 2 +
    num(p.saves) * 5
  );
}

async function getGamesForDate(date) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  const res = await fetch(url);
  const data = await res.json();

  return data.dates?.[0]?.games || [];
}

async function scoreGame(gamePk, gameDate) {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  const res = await fetch(url);
  const data = await res.json();

  const teams = data.liveData?.boxscore?.teams;

  if (!teams?.away?.players || !teams?.home?.players) {
    return [];
  }

  const players = {
    ...teams.away.players,
    ...teams.home.players,
  };

  return Object.values(players)
    .map((player) => {
      const batting = player.stats?.batting || {};
      const pitching = player.stats?.pitching || {};

      const battingPoints = round(scoreBatting(batting));
      const pitchingPoints = round(scorePitching(pitching));
      const totalPoints = round(battingPoints + pitchingPoints);

      return {
        id: player.person.id,
        name: player.person.fullName,
        teamId: player.parentTeamId,
        position: player.position?.abbreviation || "",
        gamePk,
        gameDate,

        battingStats: {
          atBats: num(batting.atBats),
          hits: num(batting.hits),
          doubles: num(batting.doubles),
          triples: num(batting.triples),
          homeRuns: num(batting.homeRuns),
          walks: num(batting.baseOnBalls),
          hitByPitch: num(batting.hitByPitch),
          caughtStealing: num(batting.caughtStealing),
          stolenBases: num(batting.stolenBases),
        },

        pitchingStats: {
          inningsPitched: pitching.inningsPitched || "0.0",
          outs: num(pitching.outs),
          hitsAllowed: num(pitching.hits),
          walksAllowed: num(pitching.baseOnBalls),
          hitBatsmen: num(pitching.hitBatsmen),
          homeRunsAllowed: num(pitching.homeRuns),
          strikeOuts: num(pitching.strikeOuts),
          saves: num(pitching.saves),
          holds: num(pitching.holds),
        },

        battingPoints,
        pitchingPoints,
        totalPoints,
      };
    })
    .filter((p) => p.totalPoints !== 0);
}

function addToLeaderboard(leaderboard, playerGame) {
  const key = String(playerGame.id);

  if (!leaderboard[key]) {
    leaderboard[key] = {
      id: playerGame.id,
      name: playerGame.name,
      teamId: playerGame.teamId,
      position: playerGame.position,
      battingPoints: 0,
      pitchingPoints: 0,
      totalPoints: 0,
      games: [],
    };
  }

  leaderboard[key].battingPoints = round(
    leaderboard[key].battingPoints + playerGame.battingPoints
  );

  leaderboard[key].pitchingPoints = round(
    leaderboard[key].pitchingPoints + playerGame.pitchingPoints
  );

  leaderboard[key].totalPoints = round(
    leaderboard[key].totalPoints + playerGame.totalPoints
  );

  leaderboard[key].games.push({
    gamePk: playerGame.gamePk,
    gameDate: playerGame.gameDate,
    battingPoints: playerGame.battingPoints,
    pitchingPoints: playerGame.pitchingPoints,
    totalPoints: playerGame.totalPoints,
  });
}

async function run() {
  const dates = getCurrentWeekDatesET();
  const leaderboard = {};

  console.log("Scoring dates:", dates.join(", "));

  for (const date of dates) {
    const games = await getGamesForDate(date);
    console.log(`${date}: ${games.length} games`);

    for (const game of games) {
      const gamePk = game.gamePk;
      const status = game.status?.abstractGameState;

      if (!["Final", "Live"].includes(status)) {
        continue;
      }

      const scoredPlayers = await scoreGame(gamePk, date);

      for (const playerGame of scoredPlayers) {
        addToLeaderboard(leaderboard, playerGame);
      }
    }
  }

  const leaders = Object.values(leaderboard)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10);

  const output = {
    generatedAt: new Date().toLocaleString("en-US", {
      timeZone: "America/New_York"
    }),
    scoringPeriod: {
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
      timezone: "America/New_York",
    },
    leaders,
  };

  const outPath = path.join(__dirname, "data", "weekly-leaders.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(leaders, null, 2));
}

run();
