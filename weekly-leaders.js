const fs = require("fs");
const path = require("path");


function num(value) {
  return Number(value || 0);
}


function round(value) {
  return Math.round(value * 100) / 100;
}


function outsToInnings(outs) {
  const fullInnings = Math.floor(outs / 3);
  const remainder = outs % 3;
  return `${fullInnings}.${remainder}`;
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


  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);


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


  const teamNameMap = {
    [teams.away.team.id]: teams.away.team.name,
    [teams.home.team.id]: teams.home.team.name,
  };


  const players = {
    ...teams.away.players,
    ...teams.home.players,
  };


  return Object.values(players)
    .map((player) => {
      const batting = player.stats?.batting || {};
      const pitching = player.stats?.pitching || {};
      const teamId = player.parentTeamId;


      const battingPoints = round(scoreBatting(batting));
      const pitchingPoints = round(scorePitching(pitching));
      const totalPoints = round(battingPoints + pitchingPoints);


      return {
        id: player.person.id,
        name: player.person.fullName,
        teamId,
        teamName: teamNameMap[teamId] || "Unknown Team",
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
      teamName: playerGame.teamName,
      position: playerGame.position,
      battingPoints: 0,
      pitchingPoints: 0,
      totalPoints: 0,


      battingStats: {
        atBats: 0,
        hits: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        walks: 0,
        hitByPitch: 0,
        caughtStealing: 0,
        stolenBases: 0,
      },


      pitchingStats: {
        outs: 0,
        inningsPitched: "0.0",
        hitsAllowed: 0,
        walksAllowed: 0,
        hitBatsmen: 0,
        homeRunsAllowed: 0,
        strikeOuts: 0,
        saves: 0,
        holds: 0,
      },


      games: [],
    };
  }


  const p = leaderboard[key];


  const alreadyCounted = p.games.some(
    (game) => Number(game.gamePk) === Number(playerGame.gamePk)
  );


  if (alreadyCounted) {
    console.log(
      `Skipping duplicate player game: ${playerGame.name} ${playerGame.gamePk}`
    );
    return;
  }


  p.battingPoints = round(p.battingPoints + playerGame.battingPoints);
  p.pitchingPoints = round(p.pitchingPoints + playerGame.pitchingPoints);
  p.totalPoints = round(p.totalPoints + playerGame.totalPoints);


  for (const stat in playerGame.battingStats) {
    p.battingStats[stat] =
      num(p.battingStats[stat]) + num(playerGame.battingStats[stat]);
  }


  for (const stat in playerGame.pitchingStats) {
    p.pitchingStats[stat] =
      num(p.pitchingStats[stat]) + num(playerGame.pitchingStats[stat]);
  }


  p.pitchingStats.inningsPitched = outsToInnings(p.pitchingStats.outs);


  p.games.push({
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
  const processedGamePks = new Set();


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


      if (processedGamePks.has(gamePk)) {
        console.log(`Skipping duplicate gamePk: ${gamePk}`);
        continue;
      }


      processedGamePks.add(gamePk);


      const scoredPlayers = await scoreGame(gamePk, date);


      for (const playerGame of scoredPlayers) {
        addToLeaderboard(leaderboard, playerGame);
      }
    }
  }


  const allPlayers = Object.values(leaderboard);


  const overallLeaders = allPlayers
    .filter((p) => p.totalPoints !== 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);


  const hitterLeaders = allPlayers
    .filter((p) => p.battingPoints !== 0)
    .sort((a, b) => b.battingPoints - a.battingPoints);


  const pitcherLeaders = allPlayers
    .filter((p) => p.pitchingPoints !== 0)
    .sort((a, b) => b.pitchingPoints - a.pitchingPoints);


  const now = new Date();


  const output = {
    generatedAt: now.toISOString(),
    generatedAtET: now.toLocaleString("en-US", {
      timeZone: "America/New_York",
    }),
    scoringPeriod: {
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
      timezone: "America/New_York",
    },
    counts: {
      overall: overallLeaders.length,
      hitters: hitterLeaders.length,
      pitchers: pitcherLeaders.length,
    },
    overallLeaders,
    hitterLeaders,
    pitcherLeaders,
    leaders: overallLeaders.slice(0, 20),
  };


  const outPath = path.join(__dirname, "data", "weekly-leaders.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));


  console.log(`Wrote ${outPath}`);
  console.log("Overall leaders:", overallLeaders.length);
  console.log("Hitter leaders:", hitterLeaders.length);
  console.log("Pitcher leaders:", pitcherLeaders.length);
}


run();

