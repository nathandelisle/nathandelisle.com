import { useState, useEffect } from 'react';

const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
const DIV_ORDER = ['IV', 'III', 'II', 'I'];

const RANK_COLORS = {
  IRON: '#5e5146',
  BRONZE: '#8c5a2d',
  SILVER: '#7b8894',
  GOLD: '#cd8837',
  PLATINUM: '#4e9996',
  EMERALD: '#0f9b53',
  DIAMOND: '#576BCE',
  MASTER: '#9D48E0',
  GRANDMASTER: '#e74c3c',
  CHALLENGER: '#f1c40f',
};

const QUEUE_NAMES = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  400: 'Normal',
  430: 'Normal',
  450: 'ARAM',
  700: 'Clash',
  900: 'URF',
  1700: 'Arena',
  1100: 'TFT Ranked',
  1090: 'TFT Normal',
  1130: 'Hyper Roll',
  1160: 'Double Up',
};

function lpToMaster(tier, rank, lp) {
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) return 0;
  const ti = TIER_ORDER.indexOf(tier);
  const di = DIV_ORDER.indexOf(rank);
  if (ti === -1 || di === -1) return null;
  return 2800 - (ti * 400 + di * 100 + lp);
}

function lpProgress(tier, rank, lp) {
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) return 100;
  const ti = TIER_ORDER.indexOf(tier);
  const di = DIV_ORDER.indexOf(rank);
  if (ti === -1 || di === -1) return 0;
  return ((ti * 400 + di * 100 + lp) / 2800) * 100;
}

function formatRank(tier, rank) {
  if (!tier) return 'Unranked';
  const t = tier.charAt(0) + tier.slice(1).toLowerCase();
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) return t;
  return `${t} ${rank}`;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getStreak(matches, isTFT) {
  if (!matches.length) return null;
  const isWin = (m) => (isTFT ? m.placement <= 4 : m.win);
  const firstResult = isWin(matches[0]);
  let count = 0;
  for (const m of matches) {
    if (isWin(m) === firstResult) count++;
    else break;
  }
  if (count < 2) return null;
  return { type: firstResult ? 'hot' : 'cold', count };
}

function Race() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch('/api/race')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  if (loading && !data) return <LoadingScreen />;
  if (error && !data) return <ErrorScreen error={error} onRetry={fetchData} />;
  if (!data) return null;

  const { nathan, isaac, ddVersion } = data;
  const nathanLP = nathan.ranked
    ? lpToMaster(nathan.ranked.tier, nathan.ranked.rank, nathan.ranked.leaguePoints)
    : null;
  const isaacLP = isaac.ranked
    ? lpToMaster(isaac.ranked.tier, isaac.ranked.rank, isaac.ranked.leaguePoints)
    : null;
  const nathanPct = nathan.ranked
    ? lpProgress(nathan.ranked.tier, nathan.ranked.rank, nathan.ranked.leaguePoints)
    : 0;
  const isaacPct = isaac.ranked
    ? lpProgress(isaac.ranked.tier, isaac.ranked.rank, isaac.ranked.leaguePoints)
    : 0;

  let leader = null;
  let lpDiff = 0;
  if (nathanLP !== null && isaacLP !== null) {
    lpDiff = Math.abs(nathanLP - isaacLP);
    leader = nathanLP < isaacLP ? 'nathan' : isaacLP < nathanLP ? 'isaac' : 'tied';
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <a href="/" style={s.backLink}>
            nathandelisle.com
          </a>
          <h1 style={s.title}>RACE TO MASTER</h1>
          <p style={s.subtitle}>League vs TFT — who hits Master first?</p>
        </div>

        <div style={s.raceTrack}>
          <ProgressBar
            name={nathan.gameName}
            pct={nathanPct}
            lpLeft={nathanLP}
            color={nathan.ranked ? RANK_COLORS[nathan.ranked.tier] : '#666'}
            leading={leader === 'nathan'}
          />
          <ProgressBar
            name={isaac.gameName}
            pct={isaacPct}
            lpLeft={isaacLP}
            color={isaac.ranked ? RANK_COLORS[isaac.ranked.tier] : '#666'}
            leading={leader === 'isaac'}
          />
          <div style={s.finishLine}>MASTER</div>
          {leader && leader !== 'tied' && (
            <p style={s.leaderText}>
              <span style={{ fontWeight: 600 }}>
                {leader === 'nathan' ? nathan.gameName : isaac.gameName}
              </span>{' '}
              leads by {lpDiff} LP
            </p>
          )}
          {leader === 'tied' && <p style={s.leaderText}>Dead even. It's anyone's race.</p>}
        </div>

        <div style={s.columns}>
          <PlayerCard player={nathan} ddVersion={ddVersion} />
          <div style={s.vsBlock}>
            <span style={s.vsText}>VS</span>
          </div>
          <PlayerCard player={isaac} ddVersion={ddVersion} />
        </div>

        <div style={s.columns}>
          <MatchHistory player={nathan} ddVersion={ddVersion} />
          <div style={s.vsSpacer} />
          <MatchHistory player={isaac} ddVersion={ddVersion} />
        </div>

        <div style={s.footer}>
          <button onClick={fetchData} disabled={loading} style={s.refreshBtn}>
            {loading ? 'Refreshing...' : 'Refresh from Riot API'}
          </button>
          <span style={s.footerText}>Showing all games from the last 4 days</span>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ name, pct, lpLeft, color, leading }) {
  return (
    <div style={s.progressRow}>
      <span style={{ ...s.progressName, fontWeight: leading ? 600 : 400 }}>{name}</span>
      <div style={s.progressTrack}>
        <div
          style={{
            ...s.progressFill,
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: color,
            opacity: leading ? 1 : 0.7,
          }}
        />
      </div>
      <span style={s.progressLP}>{lpLeft !== null ? `${lpLeft} LP` : '—'}</span>
    </div>
  );
}

function PlayerCard({ player, ddVersion }) {
  const { ranked, type, recentMatches } = player;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${player.profileIconId}.png`;

  const wins = ranked?.wins || 0;
  const losses = ranked?.losses || 0;
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

  const isTFT = type === 'tft';
  let statLabel, statValue;
  if (isTFT) {
    const avg =
      recentMatches.reduce((s, m) => s + m.placement, 0) / (recentMatches.length || 1);
    statLabel = 'Avg Placement';
    statValue = avg.toFixed(1);
  } else {
    const pool =
      recentMatches.filter((m) => m.queueId === 420).length > 0
        ? recentMatches.filter((m) => m.queueId === 420)
        : recentMatches;
    const avgK = pool.reduce((s, m) => s + m.kills, 0) / (pool.length || 1);
    const avgD = pool.reduce((s, m) => s + m.deaths, 0) / (pool.length || 1);
    const avgA = pool.reduce((s, m) => s + m.assists, 0) / (pool.length || 1);
    statLabel = 'KDA (recent)';
    statValue = avgD > 0 ? ((avgK + avgA) / avgD).toFixed(2) : 'Perfect';
  }

  const streak = getStreak(recentMatches, isTFT);
  const lastPlayed = recentMatches.length > 0 ? timeAgo(recentMatches[0].gameDate) : null;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <img src={iconUrl} alt="" style={s.profileIcon} />
        <div>
          <div style={s.playerName}>
            {player.gameName}
            <span style={s.tag}>#{player.tagLine}</span>
          </div>
          <div style={s.gameType}>
            {isTFT ? 'Teamfight Tactics' : 'League of Legends'}
          </div>
        </div>
      </div>

      {ranked ? (
        <div style={s.rankSection}>
          <div
            style={{
              ...s.rankBadge,
              color: RANK_COLORS[ranked.tier] || '#666',
              borderColor: RANK_COLORS[ranked.tier] || '#666',
            }}
          >
            {formatRank(ranked.tier, ranked.rank)}
          </div>
          <div style={s.lpText}>{ranked.leaguePoints} LP</div>
          <div style={s.recordText}>
            {isTFT ? 'Top 4 Rate' : 'Win Rate'}: {winRate}%
            <span style={s.dimText}>
              {' '}
              ({wins}W {losses}L)
            </span>
          </div>

          <div style={s.statRow}>
            <span style={s.statLabel}>{statLabel}</span>
            <span style={s.statValue}>{statValue}</span>
          </div>
          <div style={s.statRow}>
            <span style={s.statLabel}>Games Played</span>
            <span style={s.statValue}>{total}</span>
          </div>
          {streak && (
            <div style={s.statRow}>
              <span style={s.statLabel}>Streak</span>
              <span
                style={{
                  ...s.statValue,
                  color: streak.type === 'hot' ? '#2ecc71' : '#e74c3c',
                }}
              >
                {streak.count} {streak.type === 'hot' ? (isTFT ? 'top 4s' : 'wins') : (isTFT ? 'bot 4s' : 'losses')}
              </span>
            </div>
          )}
          {lastPlayed && (
            <div style={s.statRow}>
              <span style={s.statLabel}>Last Game</span>
              <span style={s.statValue}>{lastPlayed}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={s.unranked}>Unranked this split</div>
      )}
    </div>
  );
}

function MatchHistory({ player, ddVersion }) {
  const { type, recentMatches } = player;
  const isTFT = type === 'tft';

  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>Games (Last 4 Days)</h3>
      <div style={s.matchList}>
        {recentMatches.map((m, i) =>
          isTFT ? (
            <TFTMatch key={i} match={m} />
          ) : (
            <LeagueMatch key={i} match={m} ddVersion={ddVersion} />
          )
        )}
        {recentMatches.length === 0 && (
          <div style={{ color: '#999', fontSize: '14px', padding: '1rem 0' }}>
            No recent games
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueMatch({ match, ddVersion }) {
  const champUrl = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${match.champion}.png`;
  const kda = `${match.kills}/${match.deaths}/${match.assists}`;
  const mins = Math.floor(match.duration / 60);

  return (
    <div
      style={{
        ...s.matchRow,
        borderLeft: `3px solid ${match.win ? '#2ecc71' : '#e74c3c'}`,
      }}
    >
      <img
        src={champUrl}
        alt={match.champion}
        style={s.champIcon}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      <div style={s.matchInfo}>
        <div style={s.matchMain}>
          <span style={{ fontWeight: 500 }}>{match.champion}</span>
          <span style={s.matchKDA}>{kda}</span>
        </div>
        <div style={s.matchSub}>
          <span>{match.cs} CS</span>
          <span style={s.dot}>&middot;</span>
          <span>{mins}m</span>
          <span style={s.dot}>&middot;</span>
          <span style={{ color: '#aaa' }}>{QUEUE_NAMES[match.queueId] || 'Game'}</span>
        </div>
      </div>
      <span
        style={{
          ...s.matchResult,
          color: match.win ? '#2ecc71' : '#e74c3c',
        }}
      >
        {match.win ? 'W' : 'L'}
      </span>
    </div>
  );
}

function TFTMatch({ match }) {
  const placementColor =
    match.placement === 1
      ? '#FFD700'
      : match.placement <= 3
        ? '#cd8837'
        : match.placement <= 4
          ? '#4e9996'
          : '#e74c3c';
  const mins = Math.floor((match.gameLength || 0) / 60);

  return (
    <div
      style={{
        ...s.matchRow,
        borderLeft: `3px solid ${placementColor}`,
      }}
    >
      <div style={{ ...s.placement, color: placementColor }}>#{match.placement}</div>
      <div style={s.matchInfo}>
        <div style={s.matchMain}>
          <span style={{ fontWeight: 500 }}>Lv {match.level}</span>
          {match.traits.length > 0 && (
            <span style={s.matchTraits}>{match.traits.join(', ')}</span>
          )}
        </div>
        <div style={s.matchSub}>
          <span>{mins}m</span>
          <span style={s.dot}>&middot;</span>
          <span style={{ color: '#aaa' }}>{QUEUE_NAMES[match.queueId] || 'TFT'}</span>
          {match.units.length > 0 && (
            <>
              <span style={s.dot}>&middot;</span>
              <span style={{ color: '#aaa' }}>{match.units.slice(0, 4).join(', ')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={s.page}>
      <div style={{ ...s.container, textAlign: 'center', paddingTop: '8rem' }}>
        <h1 style={s.title}>RACE TO MASTER</h1>
        <p style={{ color: '#888', marginTop: '0.5rem', marginBottom: '2.5rem' }}>
          League vs TFT
        </p>
        <div className="race-loader" />
        <p style={{ color: '#aaa', marginTop: '1.5rem', fontSize: '14px' }}>
          Fetching live data from Riot...
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div style={s.page}>
      <div style={{ ...s.container, textAlign: 'center', paddingTop: '8rem' }}>
        <a href="/" style={s.backLink}>
          nathandelisle.com
        </a>
        <h1 style={{ ...s.title, marginTop: '1rem' }}>RACE TO MASTER</h1>
        <div
          style={{
            margin: '2rem auto',
            padding: '1.25rem',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            maxWidth: '28rem',
            border: '1px solid #fecaca',
          }}
        >
          <p style={{ color: '#b91c1c', fontSize: '14px', marginBottom: '0.5rem', fontWeight: 500 }}>
            Failed to load race data
          </p>
          <p style={{ color: '#999', fontSize: '13px', wordBreak: 'break-word' }}>{error}</p>
        </div>
        <button onClick={onRetry} style={s.refreshBtn}>
          Try Again
        </button>
        <p style={{ color: '#bbb', marginTop: '1rem', fontSize: '12px' }}>
          If this persists, the Riot API key may need to be refreshed.
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  container: {
    maxWidth: '54rem',
    margin: '0 auto',
    padding: '3rem 1.5rem',
  },
  header: {
    marginBottom: '2.5rem',
  },
  backLink: {
    color: '#aaa',
    textDecoration: 'none',
    fontSize: '13px',
    display: 'inline-block',
    marginBottom: '1.5rem',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '1px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: '#000',
    marginBottom: '0.375rem',
  },
  subtitle: {
    color: '#888',
    fontSize: '15px',
    margin: 0,
  },
  raceTrack: {
    marginBottom: '2.5rem',
    padding: '1.5rem 1.5rem 1rem',
    backgroundColor: '#fafafa',
    borderRadius: '10px',
    border: '1px solid #eee',
    position: 'relative',
  },
  finishLine: {
    position: 'absolute',
    top: '0.5rem',
    right: '5.5rem',
    fontSize: '10px',
    letterSpacing: '0.08em',
    color: '#bbb',
    fontWeight: 600,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.625rem',
  },
  progressName: {
    width: '85px',
    fontSize: '14px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressTrack: {
    flex: 1,
    height: '22px',
    backgroundColor: '#e8e8e8',
    borderRadius: '11px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '11px',
    transition: 'width 1s ease',
    minWidth: '4px',
  },
  progressLP: {
    width: '60px',
    fontSize: '13px',
    color: '#666',
    fontWeight: 500,
    textAlign: 'left',
  },
  leaderText: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#666',
    marginTop: '0.25rem',
    marginBottom: 0,
  },
  columns: {
    display: 'flex',
    gap: '0rem',
    marginBottom: '1.5rem',
    alignItems: 'stretch',
  },
  vsBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 0.75rem',
  },
  vsSpacer: {
    width: '3rem',
    flexShrink: 0,
  },
  vsText: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#ccc',
    letterSpacing: '0.1em',
  },
  card: {
    flex: 1,
    padding: '1.25rem',
    border: '1px solid #eee',
    borderRadius: '10px',
    backgroundColor: '#fff',
    minWidth: 0,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  profileIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '2px solid #eee',
  },
  playerName: {
    fontSize: '16px',
    fontWeight: 600,
  },
  tag: {
    color: '#aaa',
    fontWeight: 400,
    fontSize: '13px',
    marginLeft: '2px',
  },
  gameType: {
    color: '#999',
    fontSize: '12px',
    marginTop: '1px',
  },
  rankSection: {
    padding: '0.25rem 0',
  },
  rankBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    border: '1.5px solid',
    borderRadius: '5px',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  lpText: {
    fontSize: '28px',
    fontWeight: 700,
    marginBottom: '0.25rem',
    letterSpacing: '-0.02em',
  },
  recordText: {
    fontSize: '13px',
    color: '#777',
    marginBottom: '0.75rem',
  },
  dimText: {
    color: '#aaa',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.4rem 0',
    borderTop: '1px solid #f5f5f5',
    fontSize: '13px',
  },
  statLabel: {
    color: '#999',
  },
  statValue: {
    fontWeight: 500,
    color: '#333',
  },
  unranked: {
    textAlign: 'center',
    color: '#bbb',
    padding: '2rem 0',
    fontSize: '15px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '0.625rem',
    color: '#444',
    letterSpacing: '0.02em',
    marginTop: 0,
    marginBottom: '0.75rem',
  },
  matchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.625rem',
    backgroundColor: '#fafafa',
    borderRadius: '6px',
  },
  champIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '4px',
  },
  matchInfo: {
    flex: 1,
    minWidth: 0,
  },
  matchMain: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'baseline',
    fontSize: '13px',
  },
  matchKDA: {
    color: '#777',
    fontSize: '13px',
  },
  matchSub: {
    display: 'flex',
    gap: '0.25rem',
    alignItems: 'center',
    fontSize: '11px',
    color: '#bbb',
    marginTop: '1px',
  },
  matchResult: {
    fontWeight: 700,
    fontSize: '13px',
    width: '18px',
    textAlign: 'center',
    flexShrink: 0,
  },
  placement: {
    fontWeight: 700,
    fontSize: '16px',
    width: '30px',
    textAlign: 'center',
    flexShrink: 0,
  },
  matchTraits: {
    color: '#999',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dot: {
    color: '#ddd',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem 0 1rem',
    marginTop: '1rem',
  },
  refreshBtn: {
    padding: '0.5rem 1.75rem',
    backgroundColor: '#111',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  footerText: {
    display: 'block',
    color: '#ccc',
    fontSize: '11px',
    marginTop: '0.75rem',
  },
};

export default Race;
