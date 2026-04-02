const RIOT_API_KEY = process.env.RIOT_API_KEY;
const AMERICAS = 'https://americas.api.riotgames.com';
const NA1 = 'https://na1.api.riotgames.com';

async function riot(url) {
  const res = await fetch(url, {
    headers: { 'X-Riot-Token': RIOT_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Riot API ${res.status}: ${body}`);
  }
  return res.json();
}

function cleanName(raw) {
  if (!raw) return '';
  return raw
    .replace(/^(TFT\d+_|Set\d+_|TFT_Augment_|TFT_Item_)/i, '')
    .replace(/_/g, ' ');
}

async function getPlayerData(gameName, tagLine, type) {
  const account = await riot(
    `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );

  const summoner = await riot(
    `${NA1}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
  );

  const isTFT = type === 'tft';
  const [ranked, matchIds] = await Promise.all([
    isTFT
      ? riot(`${NA1}/tft/league/v1/entries/by-summoner/${summoner.id}`)
      : riot(`${NA1}/lol/league/v4/entries/by-summoner/${summoner.id}`),
    isTFT
      ? riot(`${AMERICAS}/tft/match/v1/matches/by-puuid/${account.puuid}/ids?count=10`)
      : riot(`${AMERICAS}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?count=10`),
  ]);

  const matches = await Promise.all(
    matchIds.slice(0, 7).map((id) =>
      isTFT
        ? riot(`${AMERICAS}/tft/match/v1/matches/${id}`)
        : riot(`${AMERICAS}/lol/match/v5/matches/${id}`)
    )
  );

  const queueType = isTFT ? 'RANKED_TFT' : 'RANKED_SOLO_5x5';
  const rankedEntry = ranked.find((e) => e.queueType === queueType) || null;

  const recentMatches = matches.map((m) => {
    if (isTFT) {
      const p = m.info.participants.find((x) => x.puuid === account.puuid);
      return {
        placement: p.placement,
        level: p.level,
        traits: (p.traits || [])
          .filter((t) => t.tier_current > 0)
          .sort((a, b) => b.tier_current - a.tier_current)
          .slice(0, 3)
          .map((t) => cleanName(t.name)),
        units: (p.units || []).slice(0, 6).map((u) => cleanName(u.character_id)),
        augments: (p.augments || []).map(cleanName),
        gameLength: m.info.game_length,
        gameDate: m.info.game_datetime,
        queueId: m.info.queue_id,
      };
    } else {
      const p = m.info.participants.find((x) => x.puuid === account.puuid);
      return {
        champion: p.championName,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        win: p.win,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        duration: m.info.gameDuration,
        queueId: m.info.queueId,
        gameDate: m.info.gameCreation,
      };
    }
  });

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    ranked: rankedEntry,
    recentMatches,
    type,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  if (!RIOT_API_KEY) {
    return res.status(500).json({ error: 'RIOT_API_KEY not configured' });
  }

  try {
    const versionsRes = await fetch(
      'https://ddragon.leagueoflegends.com/api/versions.json'
    );
    const versions = await versionsRes.json();

    const [nathan, isaac] = await Promise.all([
      getPlayerData('who am i', 'idrk', 'league'),
      getPlayerData('Sotatsu', 'sheep', 'tft'),
    ]);

    return res.json({ nathan, isaac, ddVersion: versions[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
