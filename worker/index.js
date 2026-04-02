const AMERICAS = 'https://americas.api.riotgames.com';
const NA1 = 'https://na1.api.riotgames.com';

async function riot(url, apiKey) {
  const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Riot API ${res.status}: ${body}`);
  }
  return res.json();
}

function cleanName(raw) {
  if (!raw) return '';
  return raw.replace(/^(TFT\d+_|Set\d+_|TFT_Augment_|TFT_Item_)/i, '').replace(/_/g, ' ');
}

async function getPlayerData(gameName, tagLine, type, apiKey) {
  const account = await riot(
    `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    apiKey
  );
  const summoner = await riot(
    `${NA1}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
    apiKey
  );

  const isTFT = type === 'tft';
  const fourDaysAgo = Math.floor(Date.now() / 1000) - 4 * 24 * 60 * 60;

  const [ranked, matchIds] = await Promise.all([
    isTFT
      ? riot(`${NA1}/tft/league/v1/entries/by-summoner/${summoner.id}`, apiKey)
      : riot(`${NA1}/lol/league/v4/entries/by-summoner/${summoner.id}`, apiKey),
    isTFT
      ? riot(`${AMERICAS}/tft/match/v1/matches/by-puuid/${account.puuid}/ids?startTime=${fourDaysAgo}&count=100`, apiKey)
      : riot(`${AMERICAS}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${fourDaysAgo}&count=100`, apiKey),
  ]);

  const matches = [];
  for (let i = 0; i < matchIds.length; i += 10) {
    const batch = await Promise.all(
      matchIds.slice(i, i + 10).map((id) =>
        isTFT
          ? riot(`${AMERICAS}/tft/match/v1/matches/${id}`, apiKey)
          : riot(`${AMERICAS}/lol/match/v5/matches/${id}`, apiKey)
      )
    );
    matches.push(...batch);
  }

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (!env.RIOT_API_KEY) {
      return new Response(JSON.stringify({ error: 'RIOT_API_KEY not configured' }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    try {
      const versionsRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await versionsRes.json();

      const [nathan, isaac] = await Promise.all([
        getPlayerData('who am i', 'idrk', 'league', env.RIOT_API_KEY),
        getPlayerData('Sotatsu', 'sheep', 'tft', env.RIOT_API_KEY),
      ]);

      return new Response(JSON.stringify({ nathan, isaac, ddVersion: versions[0] }), {
        headers: CORS_HEADERS,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
