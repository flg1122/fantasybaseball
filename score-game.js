const gamePk = "824851";

const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;

function num(value) {
  return Number(value || 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
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

async function run() {
  const res = await fetch(url);
  const data = await res.json();

  const teams = data.liveData.boxscore.teams;
  const players = {
    ...teams.away.players,
    ...teams.home.players,
  };

  const scoredPlayers = Object.values(players)
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
        position: player.position?.abbreviation,

        battingStats: {
          atBats: num(batting.atBats),
          hits: num(batting.hits),
          doubles: num(batting.doubles),
          triples: num(batting.triples),
          homeRuns: num(batting.homeRuns),
          runs: num(batting.runs),
          rbi: num(batting.rbi),
          walks: num(batting.baseOnBalls),
          strikeOuts: num(batting.strikeOuts),
          stolenBases: num(batting.stolenBases),
          totalBases: num(batting.totalBases),
          hitByPitch: num(batting.hitByPitch),
          caughtStealing: num(batting.caughtStealing),
        },

        pitchingStats: {
          inningsPitched: pitching.inningsPitched || "0.0",
          outs: num(pitching.outs),
          hitsAllowed: num(pitching.hits),
          earnedRuns: num(pitching.earnedRuns),
          walksAllowed: num(pitching.baseOnBalls),
          strikeOuts: num(pitching.strikeOuts),
          wins: num(pitching.wins),
          losses: num(pitching.losses),
          saves: num(pitching.saves),
          holds: num(pitching.holds),
          hitBatsmen: num(pitching.hitBatsmen),
          homeRunsAllowed: num(pitching.homeRuns),
        },

        battingPoints,
        pitchingPoints,
        totalPoints,
      };
    })
    .filter((p) => p.totalPoints !== 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  console.log(JSON.stringify(scoredPlayers.slice(0, 20), null, 2));
}

run();
