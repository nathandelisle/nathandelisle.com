import { useState, useEffect } from 'react';

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
const DIVS = ['IV', 'III', 'II', 'I'];

function lpToMaster(tier, rank, lp) {
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) return 0;
  const ti = TIERS.indexOf(tier);
  const di = DIVS.indexOf(rank);
  if (ti === -1 || di === -1) return null;
  return 2800 - (ti * 400 + di * 100 + lp);
}

function pct(tier, rank, lp) {
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) return 100;
  const ti = TIERS.indexOf(tier);
  const di = DIVS.indexOf(rank);
  if (ti === -1 || di === -1) return 0;
  return ((ti * 400 + di * 100 + lp) / 2800) * 100;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

const Q = { 420: 'Solo', 440: 'Flex', 400: 'Norms', 430: 'Norms', 450: 'ARAM', 1700: 'Arena', 1100: 'Ranked', 1090: 'Normal', 1130: 'Hyper Roll', 1160: 'Double Up' };

function Race() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch('https://race-api.nathandelisle.workers.dev')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Err error={error} retry={fetchData} />;
  if (!data) return null;

  const { nathan, isaac, ddVersion } = data;
  const nR = nathan.ranked, iR = isaac.ranked;
  const nLP = nR ? lpToMaster(nR.tier, nR.rank, nR.leaguePoints) : null;
  const iLP = iR ? lpToMaster(iR.tier, iR.rank, iR.leaguePoints) : null;
  const nPct = nR ? pct(nR.tier, nR.rank, nR.leaguePoints) : 0;
  const iPct = iR ? pct(iR.tier, iR.rank, iR.leaguePoints) : 0;
  const diff = nLP != null && iLP != null ? nLP - iLP : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <a href="/" style={{ color: '#484f58', fontSize: 12, textDecoration: 'none' }}>nathandelisle.com</a>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e6edf3', margin: '0.75rem 0 0.25rem' }}>Race to Master</h1>
          <p style={{ color: '#484f58', fontSize: 13, margin: 0 }}>League vs TFT</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '2rem' }}>
          <Bar name={nathan.gameName} pct={nPct} lp={nLP} rank={nR} ahead={diff < 0} />
          <Bar name={isaac.gameName} pct={iPct} lp={iLP} rank={iR} ahead={diff > 0} />
          {diff !== 0 && (
            <p style={{ color: '#484f58', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
              {diff < 0 ? nathan.gameName : isaac.gameName} leads by {Math.abs(diff)} LP
            </p>
          )}
        </div>

        {/* Two columns */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <Card player={nathan} ddVersion={ddVersion} />
          <Card player={isaac} ddVersion={ddVersion} />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Games player={nathan} ddVersion={ddVersion} />
          <Games player={isaac} ddVersion={ddVersion} />
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #21262d' }}>
          <button onClick={fetchData} disabled={loading} style={{
            background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6,
            padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <p style={{ color: '#30363d', fontSize: 11, marginTop: 8 }}>last 4 days of games</p>
        </div>
      </div>
    </div>
  );
}

function Bar({ name, pct, lp, rank, ahead }) {
  const color = rank ? {
    IRON: '#5e5146', BRONZE: '#8c5a2d', SILVER: '#7b8894', GOLD: '#cd8837',
    PLATINUM: '#4e9996', EMERALD: '#0f9b53', DIAMOND: '#576BCE', MASTER: '#9D48E0',
  }[rank.tier] || '#484f58' : '#484f58';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ width: 75, fontSize: 12, textAlign: 'right', color: ahead ? '#e6edf3' : '#484f58', fontWeight: ahead ? 600 : 400 }}>{name}</span>
      <div style={{ flex: 1, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: Math.min(pct, 100) + '%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 55, fontSize: 11, color: '#484f58', fontFamily: 'monospace' }}>{lp != null ? lp + ' LP' : '—'}</span>
    </div>
  );
}

function Card({ player, ddVersion }) {
  const r = player.ranked;
  const isTFT = player.type === 'tft';
  const icon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${player.profileIconId}.png`;

  const wins = r?.wins || 0, losses = r?.losses || 0;
  const total = wins + losses;
  const wr = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';

  const ms = player.recentMatches;
  let stat;
  if (isTFT) {
    const avg = ms.length > 0 ? (ms.reduce((s, m) => s + m.placement, 0) / ms.length).toFixed(1) : '-';
    stat = { label: 'Avg Place', value: avg };
  } else {
    const pool = ms.filter(m => m.queueId === 420).length > 0 ? ms.filter(m => m.queueId === 420) : ms;
    const k = pool.reduce((s, m) => s + m.kills, 0), d = pool.reduce((s, m) => s + m.deaths, 0), a = pool.reduce((s, m) => s + m.assists, 0);
    stat = { label: 'KDA', value: d > 0 ? ((k + a) / d).toFixed(2) : '-' };
  }

  const rankStr = r ? `${r.tier.charAt(0) + r.tier.slice(1).toLowerCase()} ${['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier) ? '' : r.rank}`.trim() : 'Unranked';

  return (
    <div style={{ flex: '1 1 300px', background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <img src={icon} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>{player.gameName}<span style={{ color: '#484f58', fontWeight: 400 }}> #{player.tagLine}</span></div>
          <div style={{ fontSize: 11, color: '#484f58' }}>{isTFT ? 'TFT' : 'League'}</div>
        </div>
      </div>
      {r ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
          <Stat label="Rank" value={rankStr} />
          <Stat label="LP" value={r.leaguePoints} />
          <Stat label={isTFT ? 'Top 4 %' : 'Win %'} value={wr + '%'} />
          <Stat label="W/L" value={`${wins}/${losses}`} />
          <Stat label={stat.label} value={stat.value} />
          <Stat label="Games (4d)" value={player.totalGames4d ?? ms.length} />
        </div>
      ) : <p style={{ color: '#484f58', fontSize: 13 }}>Unranked</p>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ color: '#484f58', fontSize: 11 }}>{label}</div>
      <div style={{ color: '#e6edf3', fontWeight: 500, fontSize: 13 }}>{value}</div>
    </div>
  );
}

function Games({ player, ddVersion }) {
  const isTFT = player.type === 'tft';
  const ms = player.recentMatches;
  return (
    <div style={{ flex: '1 1 300px', background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 12, color: '#484f58', marginBottom: 8 }}>Recent — {player.gameName}</div>
      {ms.length === 0 && <p style={{ color: '#30363d', fontSize: 12 }}>No games</p>}
      {ms.map((m, i) => isTFT ? <TRow key={i} m={m} /> : <LRow key={i} m={m} v={ddVersion} />)}
    </div>
  );
}

function LRow({ m, v }) {
  const img = `https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${m.champion}.png`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #21262d', fontSize: 12 }}>
      <img src={img} alt="" style={{ width: 24, height: 24, borderRadius: 3 }} onError={e => e.target.style.display = 'none'} />
      <span style={{ color: '#e6edf3', width: 70, fontWeight: 500 }}>{m.champion}</span>
      <span style={{ color: '#8b949e', fontFamily: 'monospace', width: 65 }}>{m.kills}/{m.deaths}/{m.assists}</span>
      <span style={{ color: '#484f58', width: 40 }}>{m.cs} cs</span>
      <span style={{ color: '#484f58', width: 30 }}>{Math.floor(m.duration / 60)}m</span>
      <span style={{ color: '#484f58', fontSize: 11 }}>{Q[m.queueId] || ''}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 600, color: m.win ? '#3fb950' : '#f85149' }}>{m.win ? 'W' : 'L'}</span>
    </div>
  );
}

function TRow({ m }) {
  const c = m.placement <= 1 ? '#e3b341' : m.placement <= 4 ? '#3fb950' : '#f85149';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #21262d', fontSize: 12 }}>
      <span style={{ color: c, fontWeight: 700, fontFamily: 'monospace', width: 24, textAlign: 'center' }}>#{m.placement}</span>
      <span style={{ color: '#8b949e', width: 35 }}>Lv{m.level}</span>
      <span style={{ color: '#484f58', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.traits.join(', ')}</span>
      <span style={{ color: '#484f58', fontSize: 11 }}>{Math.floor((m.gameLength || 0) / 60)}m</span>
      <span style={{ color: '#484f58', fontSize: 11 }}>{Q[m.queueId] || ''}</span>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600, fontFamily: '-apple-system, sans-serif' }}>Race to Master</p>
        <div className="race-loader" style={{ margin: '1rem auto' }} />
        <p style={{ color: '#484f58', fontSize: 12 }}>Loading...</p>
      </div>
    </div>
  );
}

function Err({ error, retry }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 1rem' }}>
        <p style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600 }}>Race to Master</p>
        <p style={{ color: '#f85149', fontSize: 13, margin: '1rem 0', wordBreak: 'break-word' }}>{error}</p>
        <button onClick={retry} style={{
          background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6,
          padding: '6px 16px', fontSize: 12, cursor: 'pointer',
        }}>Retry</button>
        <p style={{ color: '#30363d', fontSize: 11, marginTop: 12 }}>API key may need refresh</p>
      </div>
    </div>
  );
}

export default Race;
