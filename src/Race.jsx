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
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function sinceLabel(ts) {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function daysSince(ts) {
  return Math.round((Date.now() - ts) / (1000 * 60 * 60 * 24));
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

  const { nathan, isaac, ddVersion, since } = data;
  const nR = nathan.ranked, iR = isaac.ranked;
  const nLP = nR ? lpToMaster(nR.tier, nR.rank, nR.leaguePoints) : null;
  const iLP = iR ? lpToMaster(iR.tier, iR.rank, iR.leaguePoints) : null;
  const nPct = nR ? pct(nR.tier, nR.rank, nR.leaguePoints) : 0;
  const iPct = iR ? pct(iR.tier, iR.rank, iR.leaguePoints) : 0;
  const diff = nLP != null && iLP != null ? nLP - iLP : 0;
  const days = daysSince(since);

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <a href="/" style={{ color: '#484f58', fontSize: 12, textDecoration: 'none' }}>nathandelisle.com</a>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e6edf3', margin: '0.75rem 0 0.25rem' }}>Race to Master</h1>
          <p style={{ color: '#484f58', fontSize: 13, margin: 0 }}>League vs TFT — since {sinceLabel(since)} ({days}d window)</p>
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

        {/* LP Graph */}
        <LPGraph nathan={nathan} isaac={isaac} since={since} />

        {/* Two columns */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <Card player={nathan} ddVersion={ddVersion} days={days} />
          <Card player={isaac} ddVersion={ddVersion} days={days} />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Games player={nathan} ddVersion={ddVersion} since={since} days={days} />
          <Games player={isaac} ddVersion={ddVersion} since={since} days={days} />
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #21262d' }}>
          <button onClick={fetchData} disabled={loading} style={{
            background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6,
            padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <p style={{ color: '#30363d', fontSize: 11, marginTop: 8 }}>since {sinceLabel(since)}</p>
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

function Card({ player, ddVersion, days }) {
  const r = player.ranked;
  const isTFT = player.type === 'tft';
  const icon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${player.profileIconId}.png`;

  const wins = r?.wins || 0, losses = r?.losses || 0;
  const total = wins + losses;
  const wr = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';

  // Rolling window win rate from match details
  const ms = player.recentMatches;
  let recentW, recentL;
  if (isTFT) {
    recentW = ms.filter(m => m.placement <= 4).length;
    recentL = ms.filter(m => m.placement > 4).length;
  } else {
    recentW = ms.filter(m => m.win).length;
    recentL = ms.filter(m => !m.win).length;
  }
  const recentTotal = recentW + recentL;
  const recentWR = recentTotal > 0 ? ((recentW / recentTotal) * 100).toFixed(0) : '—';

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
        <>
          {/* Rolling window WR - prominent */}
          <div style={{ background: '#0d1117', borderRadius: 6, padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 22, fontWeight: 700, color: recentWR >= 50 ? '#3fb950' : recentWR === '—' ? '#484f58' : '#f85149' }}>{recentWR}%</span>
              <span style={{ fontSize: 11, color: '#484f58', marginLeft: 6 }}>{isTFT ? 'top 4 rate' : 'win rate'} ({days}d)</span>
            </div>
            <span style={{ fontSize: 12, color: '#8b949e', fontFamily: 'monospace' }}>{recentW}W {recentL}L</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
            <Stat label="Rank" value={rankStr} />
            <Stat label="LP" value={r.leaguePoints} />
            <Stat label={isTFT ? 'Overall Top 4%' : 'Overall WR'} value={wr + '%'} />
            <Stat label="Overall W/L" value={`${wins}/${losses}`} />
          </div>
        </>
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

function Games({ player, ddVersion, since, days }) {
  const isTFT = player.type === 'tft';
  const ms = player.recentMatches;
  return (
    <div style={{ flex: '1 1 300px', background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 12, color: '#484f58', marginBottom: 8 }}>{player.gameName} — {ms.length} games since {sinceLabel(since)}</div>
      {ms.length === 0 && <p style={{ color: '#30363d', fontSize: 12 }}>No games</p>}
      {ms.map((m, i) => isTFT ? <TRow key={i} m={m} /> : <LRow key={i} m={m} v={ddVersion} />)}
    </div>
  );
}

function LRow({ m, v }) {
  const img = `https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${m.champion}.png`;
  const kda = m.deaths > 0 ? ((m.kills + m.assists) / m.deaths).toFixed(1) : 'P';
  const dmgK = m.dmg >= 1000 ? (m.dmg / 1000).toFixed(1) + 'k' : m.dmg;
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #21262d' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <img src={img} alt="" style={{ width: 26, height: 26, borderRadius: 3 }} onError={e => { e.target.style.display = 'none'; }} />
        <span style={{ color: '#e6edf3', width: 72, fontWeight: 500 }}>{m.champion}</span>
        <span style={{ color: '#8b949e', fontFamily: 'monospace' }}>{m.kills}/{m.deaths}/{m.assists}</span>
        <span style={{ color: '#484f58', fontSize: 11 }}>({kda})</span>
        {m.mvp && <span style={{ color: '#e3b341', fontSize: 10, fontWeight: 600 }}>ACE</span>}
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: m.win ? '#3fb950' : '#f85149' }}>{m.win ? 'W' : 'L'}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#484f58', marginTop: 3, paddingLeft: 34 }}>
        <span>{m.csMin} cs/m</span>
        <span>{dmgK} dmg</span>
        <span>{m.dpm} dpm</span>
        <span>{m.vision} vis</span>
        <span>{Math.floor(m.duration / 60)}m</span>
        <span>{Q[m.queueId] || ''}</span>
        <span style={{ marginLeft: 'auto' }}>{timeAgo(m.gameDate)}</span>
      </div>
    </div>
  );
}

function TRow({ m }) {
  const c = m.placement <= 1 ? '#e3b341' : m.placement <= 4 ? '#3fb950' : '#f85149';
  const unitStr = (m.units || []).map(u => u.tier > 1 ? `${u.name}★${u.tier}` : u.name).join(', ');
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #21262d' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ color: c, fontWeight: 700, fontFamily: 'monospace', width: 26, textAlign: 'center' }}>#{m.placement}</span>
        <span style={{ color: '#8b949e' }}>Lv{m.level}</span>
        <span style={{ color: '#e6edf3', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.traits.join(', ')}</span>
        <span style={{ color: '#484f58', fontSize: 11 }}>{timeAgo(m.gameDate)}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#484f58', marginTop: 3, paddingLeft: 34 }}>
        {m.playersEliminated > 0 && <span>{m.playersEliminated} kills</span>}
        <span>{m.dmgToPlayers} dmg</span>
        <span>Rd {m.lastRound}</span>
        <span>{Math.floor((m.gameLength || 0) / 60)}m</span>
        <span>{Q[m.queueId] || ''}</span>
      </div>
      {unitStr && <div style={{ fontSize: 10, color: '#30363d', marginTop: 2, paddingLeft: 34, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unitStr}</div>}
    </div>
  );
}

function estimateLP(player) {
  const r = player.ranked;
  if (!r) return [];
  const ti = TIERS.indexOf(r.tier);
  const di = DIVS.indexOf(r.rank);
  if (ti === -1 || di === -1) return [];
  const currentAbsLP = ti * 400 + di * 100 + r.leaguePoints;
  const isTFT = player.type === 'tft';

  // Walk backwards through matches (newest first) to reconstruct LP curve
  const ms = [...player.recentMatches].reverse(); // oldest first
  const points = [];
  let lp = currentAbsLP;

  // Undo each game to get starting LP, then rebuild forward
  for (const m of [...player.recentMatches]) {
    if (isTFT) {
      const delta = m.placement <= 1 ? 38 : m.placement <= 2 ? 28 : m.placement <= 3 ? 18 : m.placement <= 4 ? 8 : m.placement <= 5 ? -8 : m.placement <= 6 ? -18 : m.placement <= 7 ? -28 : -38;
      lp -= delta;
    } else {
      lp -= m.win ? 22 : -18;
    }
  }

  // Now walk forward from estimated start
  const startLP = lp;
  points.push({ t: ms.length > 0 ? ms[0].gameDate - 3600000 : Date.now() - 4 * 86400000, lp: startLP });
  lp = startLP;
  for (const m of ms) {
    if (isTFT) {
      const delta = m.placement <= 1 ? 38 : m.placement <= 2 ? 28 : m.placement <= 3 ? 18 : m.placement <= 4 ? 8 : m.placement <= 5 ? -8 : m.placement <= 6 ? -18 : m.placement <= 7 ? -28 : -38;
      lp += delta;
    } else {
      lp += m.win ? 22 : -18;
    }
    points.push({ t: m.gameDate, lp });
  }
  // Add current point
  points.push({ t: Date.now(), lp: currentAbsLP });
  return points;
}

function LPGraph({ nathan, isaac, since }) {
  const nPts = estimateLP(nathan);
  const iPts = estimateLP(isaac);
  if (nPts.length < 2 && iPts.length < 2) return null;

  const allLP = [...nPts.map(p => p.lp), ...iPts.map(p => p.lp)];
  const minLP = Math.min(...allLP) - 15;
  const maxLP = Math.max(...allLP) + 15;
  const tMin = since;
  const tMax = Date.now();

  const W = 680, H = 140, PAD_L = 35, PAD_R = 10, PAD_T = 10, PAD_B = 22;
  const gW = W - PAD_L - PAD_R, gH = H - PAD_T - PAD_B;

  const toX = t => PAD_L + ((t - tMin) / (tMax - tMin)) * gW;
  const toY = lp => PAD_T + gH - ((lp - minLP) / (maxLP - minLP)) * gH;

  const makePath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.lp).toFixed(1)}`).join(' ');

  // Y-axis labels: show a few LP tick marks
  const lpRange = maxLP - minLP;
  const step = lpRange > 100 ? 50 : lpRange > 40 ? 20 : 10;
  const ticks = [];
  for (let v = Math.ceil(minLP / step) * step; v <= maxLP; v += step) {
    ticks.push(v);
  }

  // Rank label from absolute LP
  const rankLabel = (absLP) => {
    if (absLP >= 2800) return 'Master';
    const t = Math.floor(absLP / 400);
    const d = Math.floor((absLP % 400) / 100);
    const tierNames = ['I', 'B', 'S', 'G', 'P', 'E', 'D'];
    const divNames = ['4', '3', '2', '1'];
    return (tierNames[t] || '?') + divNames[d];
  };

  return (
    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '12px 8px 8px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: '#484f58', marginBottom: 4, paddingLeft: PAD_L }}>Estimated LP</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* Grid lines */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={toY(v)} y2={toY(v)} stroke="#21262d" strokeWidth="1" />
            <text x={PAD_L - 4} y={toY(v) + 3} fill="#30363d" fontSize="9" textAnchor="end" fontFamily="monospace">{rankLabel(v)}</text>
          </g>
        ))}
        {/* Nathan line */}
        {nPts.length > 1 && <path d={makePath(nPts)} fill="none" stroke="#576BCE" strokeWidth="2" strokeLinejoin="round" />}
        {/* Isaac line */}
        {iPts.length > 1 && <path d={makePath(iPts)} fill="none" stroke="#3fb950" strokeWidth="2" strokeLinejoin="round" />}
        {/* Dots at current */}
        {nPts.length > 0 && <circle cx={toX(nPts[nPts.length-1].t)} cy={toY(nPts[nPts.length-1].lp)} r="3" fill="#576BCE" />}
        {iPts.length > 0 && <circle cx={toX(iPts[iPts.length-1].t)} cy={toY(iPts[iPts.length-1].lp)} r="3" fill="#3fb950" />}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, marginTop: 4 }}>
        <span><span style={{ color: '#576BCE' }}>—</span> <span style={{ color: '#484f58' }}>{nathan.gameName}</span></span>
        <span><span style={{ color: '#3fb950' }}>—</span> <span style={{ color: '#484f58' }}>{isaac.gameName}</span></span>
      </div>
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
