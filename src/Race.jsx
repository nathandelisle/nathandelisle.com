import { useState, useEffect } from 'react';

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
const DIVS = ['IV', 'III', 'II', 'I'];

function absLP(tier, rank, lp) {
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) return 2800 + lp;
  const ti = TIERS.indexOf(tier);
  const di = DIVS.indexOf(rank);
  if (ti === -1 || di === -1) return null;
  return ti * 400 + di * 100 + lp;
}

function lpRemaining(tier, rank, lp, target = 2800) {
  const abs = absLP(tier, rank, lp);
  if (abs == null) return null;
  return Math.max(0, target - abs);
}

function pct(tier, rank, lp, target = 2800) {
  const abs = absLP(tier, rank, lp);
  if (abs == null) return 0;
  return Math.min(100, (abs / target) * 100);
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

  const { nathan, isaac, ciaconna, ddVersion, since } = data;
  const players = [nathan, isaac, ciaconna].filter(Boolean);
  const days = daysSince(since);

  // Compute per-player stats
  const stats = players.map(p => {
    const r = p.ranked;
    const target = p.target || 2800;
    return {
      player: p,
      lp: r ? lpRemaining(r.tier, r.rank, r.leaguePoints, target) : null,
      pct: r ? pct(r.tier, r.rank, r.leaguePoints, target) : 0,
      target,
    };
  });
  const leader = stats.filter(s => s.lp != null).sort((a, b) => a.lp - b.lp)[0];

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <a href="/" style={{ color: '#8b949e', fontSize: 13, textDecoration: 'none' }}>nathandelisle.com</a>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#e6edf3', margin: '0.75rem 0 0.25rem' }}>Race to Master</h1>
          <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>since {sinceLabel(since)} ({days}d window)</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '2rem' }}>
          {stats.map((s, i) => (
            <Bar key={i} name={s.player.gameName} pct={s.pct} lp={s.lp} rank={s.player.ranked}
              ahead={leader && s.player === leader.player}
              targetLabel={s.target > 2800 ? `M ${s.target - 2800}LP` : null} />
          ))}
          {leader && leader.lp != null && leader.lp > 0 && (
            <p style={{ color: '#8b949e', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              {leader.player.gameName} leads — {leader.lp} LP remaining
            </p>
          )}
        </div>

        {/* LP Graph */}
        <LPGraph players={players} since={since} />

        {/* Player cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {players.map((p, i) => <Card key={i} player={p} ddVersion={ddVersion} days={days} />)}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {players.map((p, i) => <Games key={i} player={p} ddVersion={ddVersion} since={since} days={days} />)}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #30363d' }}>
          <button onClick={fetchData} disabled={loading} style={{
            background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <p style={{ color: '#6e7681', fontSize: 12, marginTop: 8 }}>since {sinceLabel(since)}</p>
        </div>
      </div>
    </div>
  );
}

function Bar({ name, pct, lp, rank, ahead, targetLabel }) {
  const color = rank ? {
    IRON: '#5e5146', BRONZE: '#8c5a2d', SILVER: '#7b8894', GOLD: '#cd8837',
    PLATINUM: '#4e9996', EMERALD: '#0f9b53', DIAMOND: '#576BCE', MASTER: '#9D48E0',
  }[rank.tier] || '#6e7681' : '#6e7681';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ width: 90, fontSize: 13, textAlign: 'right', color: ahead ? '#e6edf3' : '#8b949e', fontWeight: ahead ? 600 : 400 }}>
        {name}
        {targetLabel && <span style={{ fontSize: 10, color: '#6e7681', display: 'block' }}>{targetLabel}</span>}
      </span>
      <div style={{ flex: 1, height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: Math.min(pct, 100) + '%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 60, fontSize: 12, color: '#8b949e', fontFamily: 'monospace' }}>{lp != null ? lp + ' LP' : '—'}</span>
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
    <div style={{ flex: '1 1 300px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <img src={icon} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{player.gameName}<span style={{ color: '#6e7681', fontWeight: 400 }}> #{player.tagLine}</span></div>
          <div style={{ fontSize: 12, color: '#8b949e' }}>{isTFT ? 'TFT' : 'League'}</div>
        </div>
      </div>
      {r ? (
        <>
          <div style={{ background: '#0d1117', borderRadius: 6, padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 24, fontWeight: 700, color: recentWR >= 50 ? '#3fb950' : recentWR === '—' ? '#6e7681' : '#f85149' }}>{recentWR}%</span>
              <span style={{ fontSize: 12, color: '#8b949e', marginLeft: 6 }}>{isTFT ? 'top 4 rate' : 'win rate'} ({days}d)</span>
            </div>
            <span style={{ fontSize: 13, color: '#c9d1d9', fontFamily: 'monospace' }}>{recentW}W {recentL}L</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
            <Stat label="Rank" value={rankStr} />
            <Stat label="LP" value={r.leaguePoints} />
            <Stat label={isTFT ? 'Overall Top 4%' : 'Overall WR'} value={wr + '%'} />
            <Stat label="Overall W/L" value={`${wins}/${losses}`} />
          </div>
        </>
      ) : <p style={{ color: '#6e7681', fontSize: 14 }}>Unranked</p>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ color: '#8b949e', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#e6edf3', fontWeight: 500, fontSize: 14 }}>{value}</div>
    </div>
  );
}

function Games({ player, ddVersion, since, days }) {
  const isTFT = player.type === 'tft';
  const ms = player.recentMatches;
  return (
    <div style={{ flex: '1 1 300px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 10 }}>{player.gameName} — {ms.length} games since {sinceLabel(since)}</div>
      {ms.length === 0 && <p style={{ color: '#6e7681', fontSize: 13 }}>No games</p>}
      {ms.map((m, i) => isTFT ? <TRow key={i} m={m} /> : <LRow key={i} m={m} v={ddVersion} />)}
    </div>
  );
}

function LRow({ m, v }) {
  const img = `https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${m.champion}.png`;
  const kda = m.deaths > 0 ? ((m.kills + m.assists) / m.deaths).toFixed(1) : 'P';
  const dmgK = m.dmg >= 1000 ? (m.dmg / 1000).toFixed(1) + 'k' : m.dmg;
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid #21262d' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <img src={img} alt="" style={{ width: 28, height: 28, borderRadius: 3 }} onError={e => { e.target.style.display = 'none'; }} />
        <span style={{ color: '#e6edf3', width: 76, fontWeight: 500 }}>{m.champion}</span>
        <span style={{ color: '#c9d1d9', fontFamily: 'monospace' }}>{m.kills}/{m.deaths}/{m.assists}</span>
        <span style={{ color: '#8b949e', fontSize: 12 }}>({kda})</span>
        {m.mvp && <span style={{ color: '#e3b341', fontSize: 11, fontWeight: 600 }}>ACE</span>}
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: m.win ? '#3fb950' : '#f85149' }}>{m.win ? 'W' : 'L'}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: m.win ? '#3fb950' : '#f85149' }}>{m.win ? '+22' : '-18'}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#8b949e', marginTop: 4, paddingLeft: 36 }}>
        <span>{m.csMin} cs/m</span>
        <span>{dmgK} dmg</span>
        <span>{m.dpm} dpm</span>
        <span>{m.vision} vis</span>
        <span>{Math.floor(m.duration / 60)}m</span>
        <span>{Q[m.queueId] || ''}</span>
        <span style={{ marginLeft: 'auto', color: '#6e7681' }}>{timeAgo(m.gameDate)}</span>
      </div>
    </div>
  );
}

function TRow({ m }) {
  const c = m.placement <= 1 ? '#e3b341' : m.placement <= 4 ? '#3fb950' : '#f85149';
  const unitStr = (m.units || []).map(u => u.tier > 1 ? `${u.name}★${u.tier}` : u.name).join(', ');
  const lpDelta = m.placement <= 1 ? 38 : m.placement <= 2 ? 28 : m.placement <= 3 ? 18 : m.placement <= 4 ? 8 : m.placement <= 5 ? -8 : m.placement <= 6 ? -18 : m.placement <= 7 ? -28 : -38;
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid #21262d' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color: c, fontWeight: 700, fontFamily: 'monospace', width: 28, textAlign: 'center' }}>#{m.placement}</span>
        <span style={{ color: '#c9d1d9' }}>Lv{m.level}</span>
        <span style={{ color: '#e6edf3', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.traits.join(', ')}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: lpDelta >= 0 ? '#3fb950' : '#f85149' }}>{lpDelta > 0 ? '+' : ''}{lpDelta}</span>
        <span style={{ color: '#6e7681', fontSize: 12 }}>{timeAgo(m.gameDate)}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#8b949e', marginTop: 4, paddingLeft: 36 }}>
        {m.playersEliminated > 0 && <span>{m.playersEliminated} kills</span>}
        <span>{m.dmgToPlayers} dmg</span>
        <span>Rd {m.lastRound}</span>
        <span>{Math.floor((m.gameLength || 0) / 60)}m</span>
        <span>{Q[m.queueId] || ''}</span>
      </div>
      {unitStr && <div style={{ fontSize: 11, color: '#6e7681', marginTop: 3, paddingLeft: 36, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unitStr}</div>}
    </div>
  );
}

function estimateLP(player) {
  const r = player.ranked;
  if (!r) return [];
  const currentAbs = absLP(r.tier, r.rank, r.leaguePoints);
  if (currentAbs == null) return [];
  const isTFT = player.type === 'tft';

  const ms = [...player.recentMatches].reverse(); // oldest first
  let lp = currentAbs;

  // Undo each game to get starting LP
  for (const m of [...player.recentMatches]) {
    if (isTFT) {
      const delta = m.placement <= 1 ? 38 : m.placement <= 2 ? 28 : m.placement <= 3 ? 18 : m.placement <= 4 ? 8 : m.placement <= 5 ? -8 : m.placement <= 6 ? -18 : m.placement <= 7 ? -28 : -38;
      lp -= delta;
    } else {
      lp -= m.win ? 22 : -18;
    }
  }

  // Walk forward from estimated start
  const startLP = lp;
  const points = [];
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
  points.push({ t: Date.now(), lp: currentAbs });
  return points;
}

const PLAYER_COLORS = ['#576BCE', '#3fb950', '#da7b3c'];

function LPGraph({ players, since }) {
  const [hover, setHover] = useState(null);
  const allPts = players.map(p => estimateLP(p));
  if (allPts.every(pts => pts.length < 2)) return null;

  const allLP = allPts.flat().map(p => p.lp);
  const minLP = Math.min(...allLP) - 15;
  const maxLP = Math.max(...allLP) + 15;
  const tMin = since;
  const tMax = Date.now();

  const W = 680, H = 170, PAD_L = 38, PAD_R = 10, PAD_T = 10, PAD_B = 24;
  const gW = W - PAD_L - PAD_R, gH = H - PAD_T - PAD_B;

  const toX = t => PAD_L + ((t - tMin) / (tMax - tMin)) * gW;
  const toY = lp => PAD_T + gH - ((lp - minLP) / (maxLP - minLP)) * gH;
  const fromX = x => tMin + ((x - PAD_L) / gW) * (tMax - tMin);

  const makePath = (pts) => {
    if (pts.length === 0) return '';
    let d = `M${toX(pts[0].t).toFixed(1)},${toY(pts[0].lp).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H${toX(pts[i].t).toFixed(1)} V${toY(pts[i].lp).toFixed(1)}`;
    }
    return d;
  };

  const lpRange = maxLP - minLP;
  const step = lpRange > 100 ? 50 : lpRange > 40 ? 20 : 10;
  const ticks = [];
  for (let v = Math.ceil(minLP / step) * step; v <= maxLP; v += step) {
    ticks.push(v);
  }

  const dayMs = 86400000;
  const startDay = new Date(tMin);
  startDay.setHours(0, 0, 0, 0);
  const xTicks = [];
  for (let d = startDay.getTime() + dayMs; d < tMax; d += dayMs) {
    xTicks.push(d);
  }

  const rankLabel = (val) => {
    if (val >= 2800) return `M${val - 2800}`;
    const t = Math.floor(val / 400);
    const d = Math.floor((val % 400) / 100);
    const tierNames = ['I', 'B', 'S', 'G', 'P', 'E', 'D'];
    const divNames = ['4', '3', '2', '1'];
    return (tierNames[t] || '?') + divNames[d];
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayLabel = (ts) => {
    const d = new Date(ts);
    return months[d.getMonth()] + ' ' + d.getDate();
  };

  const lpAt = (pts, t) => {
    if (pts.length === 0) return null;
    if (t <= pts[0].t) return pts[0].lp;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (t >= pts[i].t) return pts[i].lp;
    }
    return pts[0].lp;
  };

  const handleMouse = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < PAD_L || svgX > W - PAD_R) { setHover(null); return; }
    const t = fromX(svgX);
    const lpValues = allPts.map(pts => pts.length > 1 ? lpAt(pts, t) : null);
    setHover({ x: svgX, t, lpValues });
  };

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 10px 10px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6, paddingLeft: PAD_L }}>Estimated LP</div>
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouse} onMouseLeave={() => setHover(null)}>
          {ticks.map(v => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={toY(v)} y2={toY(v)} stroke="#30363d" strokeWidth="1" />
              <text x={PAD_L - 5} y={toY(v) + 3.5} fill="#8b949e" fontSize="10" textAnchor="end" fontFamily="monospace">{rankLabel(v)}</text>
            </g>
          ))}
          {xTicks.map(t => (
            <g key={t}>
              <line x1={toX(t)} x2={toX(t)} y1={PAD_T} y2={PAD_T + gH} stroke="#30363d" strokeWidth="1" strokeDasharray="3,3" />
              <text x={toX(t)} y={H - 5} fill="#8b949e" fontSize="10" textAnchor="middle" fontFamily="monospace">{dayLabel(t)}</text>
            </g>
          ))}
          {allPts.map((pts, i) => pts.length > 1 && (
            <path key={i} d={makePath(pts)} fill="none" stroke={PLAYER_COLORS[i]} strokeWidth="2.5" strokeLinejoin="round" />
          ))}
          {allPts.map((pts, i) => pts.length > 0 && (
            <circle key={i} cx={toX(pts[pts.length-1].t)} cy={toY(pts[pts.length-1].lp)} r="4" fill={PLAYER_COLORS[i]} />
          ))}
          {hover && (
            <>
              <line x1={hover.x} x2={hover.x} y1={PAD_T} y2={PAD_T + gH} stroke="#6e7681" strokeWidth="1" strokeDasharray="2,2" />
              {hover.lpValues.map((lp, i) => lp != null && (
                <circle key={i} cx={hover.x} cy={toY(lp)} r="5" fill={PLAYER_COLORS[i]} stroke="#161b22" strokeWidth="2" />
              ))}
            </>
          )}
        </svg>
        {hover && hover.lpValues.some(v => v != null) && (
          <div style={{
            position: 'absolute', top: 6,
            left: hover.x > W / 2 ? undefined : `${(hover.x / W) * 100}%`,
            right: hover.x > W / 2 ? `${((W - hover.x) / W) * 100}%` : undefined,
            background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
            padding: '6px 10px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
          }}>
            <div style={{ color: '#8b949e', marginBottom: 3 }}>{dayLabel(hover.t)} {new Date(hover.t).getHours()}:{String(new Date(hover.t).getMinutes()).padStart(2, '0')}</div>
            {hover.lpValues.map((lp, i) => lp != null && (
              <div key={i} style={{ color: PLAYER_COLORS[i] }}>{players[i].gameName}: {rankLabel(lp)} ({lp % 100} LP)</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12, marginTop: 6 }}>
        {players.map((p, i) => (
          <span key={i}><span style={{ color: PLAYER_COLORS[i] }}>--</span> <span style={{ color: '#8b949e' }}>{p.gameName}</span></span>
        ))}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#e6edf3', fontSize: 18, fontWeight: 600, fontFamily: '-apple-system, sans-serif' }}>Race to Master</p>
        <div className="race-loader" style={{ margin: '1rem auto' }} />
        <p style={{ color: '#8b949e', fontSize: 13 }}>Loading...</p>
      </div>
    </div>
  );
}

function Err({ error, retry }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 1rem' }}>
        <p style={{ color: '#e6edf3', fontSize: 18, fontWeight: 600 }}>Race to Master</p>
        <p style={{ color: '#f85149', fontSize: 14, margin: '1rem 0', wordBreak: 'break-word' }}>{error}</p>
        <button onClick={retry} style={{
          background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 6,
          padding: '8px 20px', fontSize: 13, cursor: 'pointer',
        }}>Retry</button>
        <p style={{ color: '#6e7681', fontSize: 12, marginTop: 12 }}>API key may need refresh</p>
      </div>
    </div>
  );
}

export default Race;
