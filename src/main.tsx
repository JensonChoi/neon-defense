import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './game/engine.ts';
import { TOWERS } from './game/config.ts';
import {PADS} from './game/paths.ts';
import {towerStats,upgradeCost,sellValue} from './game/economy.ts';
import type { TowerKind } from './game/config.ts';
import { WAVE_NAMES, makeWave } from './game/waves.ts';
import { AudioSystem } from './game/audio.ts';
import { Battlefield } from './render/scene.ts';
import type { Settings } from './render/scene.ts';
import './style.css';
import { installTestBridge } from './debug.ts';
const game = new Game();
const audio = new AudioSystem();
const DEFAULT_SETTINGS: Settings = { quality: 'medium', volume: .35, music: .12, reducedMotion: false, damageNumbers: true };
function loadSettings(): Settings { try {
    const s = JSON.parse(localStorage.getItem('neon-settings') ?? '{}');
    return { quality: ['low', 'medium', 'high'].includes(s.quality) ? s.quality : 'medium', volume: typeof s.volume === 'number' ? Math.max(0, Math.min(1, s.volume)) : .35, music: typeof s.music === 'number' ? Math.max(0, Math.min(1, s.music)) : .12, reducedMotion: s.reducedMotion === true, damageNumbers: s.damageNumbers !== false };
}
catch {
    return DEFAULT_SETTINGS;
} }
function loadBest() { try {
    return Number(localStorage.getItem('neon-best') ?? 0) || 0;
}
catch {
    return 0;
} }
const kinds = Object.keys(TOWERS) as TowerKind[];
function Icon({ kind, className = '' }: {
    kind: string;
    className?: string;
}) {
    const paths: Record<string, React.ReactNode> = {
        laser: <><path d="M9 18h14M13 18V9h6v9M16 9V3M12 5h8M10 23h12"/><path d="m21 6 5-3M23 10l6-1"/></>,
        missile: <><path d="m8 20 7-13 9 5-7 13zM13 11l9 5M7 23l-2 5M11 25l-2 5M16 7l7-4 1 9"/></>,
        tesla: <><path d="m18 2-9 14h7l-2 14 10-17h-7z"/></>,
        railgun: <><path d="m6 22 17-17 4 4-17 17zM5 27l-2 2M16 9l7 7M4 19l7 7M21 3l8 8"/></>,
        cryo: <><path d="M16 2v28M4 9l24 14M4 23 28 9M12 5l4 4 4-4M12 27l4-4 4 4M5 14l6-1-2-6M23 25l-2-6 6-1M5 18l6 1-2 6M23 7l-2 6 6 1"/></>,
        core: <><path d="m16 3 12 7v13l-12 7-12-7V10zM16 10l6 4v6l-6 4-6-4v-6z"/></>,
        pause: <><path d="M11 7v18M21 7v18"/></>, play: <path d="m11 6 15 10-15 10z"/>, settings: <><path d="M5 8h22M5 16h22M5 24h22M11 5v6M22 13v6M14 21v6"/></>, target: <><circle cx="16" cy="16" r="9"/><path d="M16 2v8M16 22v8M2 16h8M22 16h8"/></>, close: <path d="m8 8 16 16M24 8 8 24"/>, arrow: <path d="M4 16h24M19 7l9 9-9 9"/>, sound: <><path d="m5 12 6 0 7-6v20l-7-6H5zM23 10q8 6 0 12"/></>
    };
    return <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{paths[kind] ?? paths.core}</svg>;
}
function App() {
    const s = useSyncExternalStore(game.subscribe, game.getSnapshot);
    const host = useRef<HTMLDivElement>(null), scene = useRef<Battlefield | null>(null), minimap = useRef<HTMLCanvasElement>(null);
    const [settings, setSettings] = useState(loadSettings);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [error, setError] = useState('');
    const [chosen, setChosen] = useState<TowerKind>('laser');
    const [best, setBest] = useState(loadBest);
    const [help, setHelp] = useState(false);
    const [confirmRestart, setConfirmRestart] = useState(false);
    const [flyover, setFlyover] = useState(false);
    const wasPaused = useRef(false);
    useEffect(() => { try {
        scene.current = new Battlefield(host.current!, game, audio, settings, setError);
        scene.current.setMinimap(minimap.current);
        if (import.meta.env.DEV && new URLSearchParams(location.search).has('test'))
            installTestBridge(game, scene.current);
    }
    catch (e) {
        setError(`Unable to initialize 3D graphics. ${e instanceof Error ? e.message : String(e)}`);
    } return () => { scene.current?.dispose(); audio.dispose(); }; }, []);
    useEffect(() => { scene.current?.applySettings(settings); try {
        localStorage.setItem('neon-settings', JSON.stringify(settings));
    }
    catch { /* Private browsing can disable storage. */ } }, [settings]);
    useEffect(() => { scene.current?.setMinimap(minimap.current); }, [s.phase]);
    useEffect(() => { if (s.phase === 'victory' || s.phase === 'defeat') {
        const score = s.kills * 10 + s.wave * 100 + s.hp * 50;
        if (score > best) {
            setBest(score);
            try {
                localStorage.setItem('neon-best', String(score));
            }
            catch { /* Optional persistence. */ }
        }
    } }, [s.phase]);
    useEffect(() => { if (!flyover)
        return; const timer = window.setTimeout(() => setFlyover(false), 2200); return () => clearTimeout(timer); }, [flyover]);
    function start() { audio.unlock(); game.reset(); scene.current?.startFlyover(); setFlyover(true); setConfirmRestart(false); setSettingsOpen(false); setHelp(false); }
    function openSettings() { wasPaused.current = game.paused; if (game.editable() && !game.paused)
        game.togglePause(); setSettingsOpen(true); }
    function closeSettings() { setSettingsOpen(false); if (game.paused && !wasPaused.current)
        game.togglePause(); }
    function preview(kind: TowerKind) { setChosen(kind); scene.current?.setPreview(kind); }
    const tower = s.towers.find(t => t.pad === s.selected), kind = tower?.kind ?? chosen, config = TOWERS[kind], stats = towerStats(kind, tower?.level ?? 0);
    const next = tower ? towerStats(kind, tower.level + 1) : stats;
    const nextWave = Math.min(20, s.wave + (s.phase === 'preparation' ? 1 : 0));
    const waveKinds = Array.from(new Set(makeWave(nextWave || 1).map(x => x.kind)));
    const playing = s.phase !== 'menu';
    return <div className={`app ${settings.reducedMotion ? 'reduced-motion' : ''}`}>
  <div ref={host} className="battlefield"/>
  <div className="screen-vignette"/>
  <header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()}><span className="brand-emblem">N<span>/</span></span><span>NEON<span className="brand-light">DEFENSE</span><small>TACTICAL DEFENSE SYSTEM</small></span></a>
   <div className="sector"><span className="live-dot"/> NETWORK ONLINE <span className="divider">/</span> SECTOR 07</div>
   <div className="top-actions"><span className="version">v1.0</span><button className="icon-button" aria-label="How to play" onClick={() => { if (game.editable() && !game.paused)
        game.togglePause(); setHelp(true); }}>?</button><button className="icon-button" aria-label="Settings" onClick={openSettings}><Icon kind="settings"/></button></div>
  </header>
  {playing && <>
   <div className="statusbar">
    <div className="metric credits"><span className="metric-icon">◈</span><div><label>AVAILABLE CREDITS</label><strong>{s.credits.toLocaleString()}<small> CR</small></strong></div></div>
    <div className="metric reactor"><Icon kind="core"/><div><label>REACTOR INTEGRITY</label><strong className={s.hp <= 5 ? 'danger' : ''}>{s.hp * 5}<small>%</small></strong><div className="health-track"><i style={{ width: `${s.hp * 5}%`, background: s.hp <= 5 ? 'var(--red)' : undefined }}/></div></div></div>
    <div className="metric"><div><label>WAVE PROGRESS</label><strong>{String(s.wave).padStart(2, '0')}<small> / 20</small></strong></div></div>
    <div className="metric"><div><label>HOSTILES REMAINING</label><strong>{String(s.remaining).padStart(2, '0')}<small> {s.queued > 0 ? `${s.queued} INBOUND` : 'ON RADAR'}</small></strong></div></div>
    <div className="simulation"><span>SIMULATION</span><div>{[1, 2, 3].map(speed => <button key={speed} className={s.speed === speed ? 'active' : ''} onClick={() => game.setSpeed(speed)} aria-label={`Game speed ${speed}x`}>{speed}×</button>)}<button className="pause-button" aria-label={s.paused ? 'Resume' : 'Pause'} onClick={() => game.togglePause()}><Icon kind={s.paused ? 'play' : 'pause'}/></button></div></div>
   </div>
   <aside className="mission-panel"><div className="eyebrow"><span className="live-dot"/> OPERATION NIGHTFALL</div><h2>Hold the line.</h2><p>Protect the reactor.<br />Keep the city alive.</p><div className="objective"><Icon kind="core"/><div><b>POWER REACTOR</b><span>{s.hp} / 20 HP <i>● ONLINE</i></span></div></div><div className="mission-rule"/><div className="eyebrow">{s.phase === 'combat' ? 'CURRENT THREAT' : 'NEXT WAVE INTEL'} <span className="tag">{String(nextWave).padStart(2, '0')}</span></div><h3>{WAVE_NAMES[(nextWave || 1) - 1]}</h3><div className="enemy-intel">{waveKinds.map(k => <span key={k} className={k === 'boss' ? 'boss-tag' : ''}>{k === 'scout' ? 'Scout drone' : k === 'boss' ? '⚠ Boss mech' : `${k[0].toUpperCase()}${k.slice(1)}`}</span>)}</div><p className="hint">{s.wave === 0 ? 'Start with a laser turret near entrance 01. Glowing hexagons are build sites.' : s.wave % 5 === 4 ? 'Boss EMPs disable nearby towers. Spread your defenses.' : 'Combine cryo fields with splash damage to control groups.'}</p></aside>
   <aside className="build-panel panel">
    <div className="panel-heading"><span className="eyebrow">{tower ? 'TOWER COMMAND' : 'DEFENSE SYSTEMS'}</span><span className="muted">{s.selected === null ? 'SELECT A SITE' : `SITE ${String(s.selected + 1).padStart(2, '0')}`}</span></div>
    {tower ? <><div className="tower-hero" style={{ color: config.color }}><Icon kind={kind}/><div><span className="eyebrow">{config.label}</span><h2>{config.name}</h2><div className="level-pips">{[0, 1, 2, 3].map(n => <i key={n} className={n <= tower.level ? 'filled' : ''}/>)}<span>{tower.level === 3 ? 'MAX LEVEL' : `LEVEL ${tower.level + 1}`}</span></div></div></div><p className="tower-description">{config.description}</p><div className="stats-grid"><div><label>DAMAGE</label><strong>{stats.damage.toFixed(0)}{tower.level < 3 && <small> → {next.damage.toFixed(0)}</small>}</strong></div><div><label>RANGE</label><strong>{stats.range.toFixed(1)}<small> m</small></strong></div><div><label>FIRE RATE</label><strong>{stats.rate.toFixed(2)}<small> /s</small></strong></div><div><label>{kind === 'cryo' ? 'SLOW' : kind === 'tesla' ? 'CHAIN TARGETS' : 'INVESTED'}</label><strong>{kind === 'cryo' ? `${Math.round(stats.slow * 100)}%` : kind === 'tesla' ? stats.chains : `${tower.invested} CR`}</strong></div></div>{tower.disabledUntil > game.time && <p className="danger">EMP interference — rebooting systems</p>}<button className="primary full" disabled={tower.level === 3 || s.credits < upgradeCost(kind, tower.level)} onClick={() => game.upgrade()}>{tower.level === 3 ? 'FULLY UPGRADED' : `UPGRADE · ${upgradeCost(kind, tower.level)} CR`}<span>↑</span></button><button className="sell-button full" onClick={() => game.sell()}>RECYCLE TOWER <span>+{sellValue(tower.invested)} CR</span></button></> : <>
     <h2>Build your defense<span>.</span></h2><p className="subcopy">{s.selected === null ? 'Select a glowing site on the battlefield.' : 'Choose a weapon. Make every credit count.'}</p>
     <div className="tower-list">{kinds.map((k, i) => <button key={k} className={`tower-option ${chosen === k ? 'chosen' : ''}`} style={{ '--tower-color': TOWERS[k].color } as React.CSSProperties} onClick={() => preview(k)} onMouseEnter={() => scene.current?.setPreview(k)} onMouseLeave={() => scene.current?.setPreview(chosen)} aria-label={`Select ${TOWERS[k].name}`}><span className="tower-symbol"><Icon kind={k}/></span><span className="tower-name"><b>{TOWERS[k].name}</b><small>{TOWERS[k].label}</small></span><span className={`tower-price ${s.credits < TOWERS[k].cost ? 'unaffordable' : ''}`}>{TOWERS[k].cost}<small> CR</small></span><span className="tower-index">0{i + 1}</span></button>)}</div>
     <div className="build-detail"><div><span style={{ color: config.color }}>{config.label.split(' / ')[1]}</span><span>RANGE {stats.range.toFixed(1)}m</span></div><p>{config.description}</p></div>
     <button className="primary full" disabled={s.selected === null || s.credits < config.cost} onClick={() => { audio.unlock(); game.build(chosen); }}> {s.selected === null ? 'SELECT A BUILD SITE' : s.credits < config.cost ? 'INSUFFICIENT CREDITS' : `DEPLOY ${config.name.toUpperCase()}`}<span>{s.selected !== null ? '↗' : '⌖'}</span></button>
    </>}
    <div className="panel-footer"><span className="live-dot"/> {s.towers.length} / {PADS.length} SITES OCCUPIED</div>
   </aside>
   <div className="map-panel panel"><div className="panel-heading"><span className="eyebrow">SECTOR OVERVIEW</span><button aria-label="Reset camera" className="tiny-button" onClick={() => scene.current?.resetCamera()}><Icon kind="target"/></button></div><canvas width="210" height="135" ref={minimap} aria-label="Minimap of enemy and tower positions"/><div className="map-legend"><span><i /> DEFENSE</span><span><i /> HOSTILE</span><span>07 / NEO TOKYO</span></div></div>
   <div className={`transmission ${s.notice.includes('BREACH') ? 'alert' : ''}`} role="status"><span>⌁</span><div><small>COMMAND FEED</small><p>{s.notice}</p></div></div>
   <div className="wave-control panel"><div><span className="eyebrow">{s.phase === 'combat' ? 'WAVE IN PROGRESS' : s.hold ? 'AWAITING YOUR COMMAND' : 'NEXT DEPLOYMENT'}</span><strong>{s.phase === 'combat' ? `WAVE ${String(s.wave).padStart(2, '0')}` : s.hold ? 'SYSTEMS READY' : `${Math.ceil(s.countdown)}s`}<span className="live-dot"/></strong></div>{s.phase === 'preparation' ? <><button className="hold-button" onClick={() => game.toggleHold()} aria-label={s.hold ? 'Enable countdown' : 'Hold countdown'}>{s.hold ? 'AUTO OFF' : 'HOLD'}</button><button className="primary launch" onClick={() => { audio.unlock(); game.startWave(); }}>START WAVE {String(s.wave + 1).padStart(2, '0')}<Icon kind="arrow"/></button></> : <div className="combat-progress"><span>DEFEND THE REACTOR</span><div><i style={{ width: `${Math.max(3, 100 - s.remaining / makeWave(s.wave).length * 100)}%` }}/></div></div>}</div>
   <footer className="bottom-bar"><div><kbd>W A S D</kbd> PAN <span>·</span><kbd>RMB</kbd> ROTATE <span>·</span><kbd>SCROLL</kbd> ZOOM <span>·</span><kbd>ESC</kbd> CANCEL / PAUSE</div><span><i className="live-dot"/> {s.paused ? 'SIMULATION PAUSED' : 'ALL SYSTEMS NOMINAL'}</span></footer>
  </>}
  {!playing && <div className="main-menu"><div className="eyebrow"><span className="live-dot"/> A CITY ON THE EDGE OF TOMORROW</div><h1>DEFEND<br />THE LAST <em>LIGHT.</em></h1><p>The machines are coming. Build your defenses,<br />command the skyline, and keep the heart of the city beating.</p><div className="menu-facts"><span><b>20</b> WAVES</span><span><b>05</b> TOWER SYSTEMS</span><span><b>01</b> LAST CHANCE</span></div><button className="primary begin" onClick={start}>INITIALIZE DEFENSE<Icon kind="arrow"/></button><div className="menu-secondary"><button onClick={() => setHelp(true)}>FIELD MANUAL ↗</button><span>PERSONAL BEST <b>{best.toLocaleString()}</b></span></div><div className="menu-coordinate">35°41′22.2″N 139°41′30.1″E <span>NEO TOKYO / SECTOR 07</span></div></div>}
  {flyover && <button className="skip" onClick={() => { scene.current?.skipFlyover(); setFlyover(false); }}>SKIP INTRO →</button>}
  {s.paused && !settingsOpen && !help && !confirmRestart && playing && <div className="overlay"><div className="modal pause-modal"><span className="eyebrow">TACTICAL BREAK</span><h2>Time is on your side.</h2><p>The battlefield is paused. Take a breath, commander.</p><button className="primary full" onClick={() => game.togglePause()}>RESUME DEFENSE<Icon kind="play"/></button><button className="secondary full" onClick={openSettings}>SETTINGS</button><button className="text-button" onClick={() => setConfirmRestart(true)}>Restart operation</button></div></div>}
  {(s.phase === 'victory' || s.phase === 'defeat') && <div className="overlay end-overlay"><div className="modal end-modal"><span className={`eyebrow ${s.phase === 'defeat' ? 'danger' : ''}`}>{s.phase === 'victory' ? 'OPERATION COMPLETE' : 'SIGNAL LOST'}</span><Icon kind="core" className="end-icon"/><h2>{s.phase === 'victory' ? 'The city lives.' : 'The lights went out.'}</h2><p>{s.phase === 'victory' ? 'Twenty waves. One unbroken line. You held the future.' : 'The reactor has fallen. Rebuild, adapt, and take back the night.'}</p><div className="end-stats"><div><b>{s.wave}<small>/20</small></b><span>WAVES REACHED</span></div><div><b>{s.kills}</b><span>HOSTILES ELIMINATED</span></div><div><b>{s.kills * 10 + s.wave * 100 + s.hp * 50}</b><span>FINAL SCORE</span></div></div><button className="primary full" onClick={start}>DEPLOY AGAIN<Icon kind="arrow"/></button><button className="text-button" onClick={() => { game.phase = 'menu'; game.publish(); }}>Return to main menu</button></div></div>}
  {settingsOpen && <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="Settings"><div className="modal-heading"><span className="eyebrow">SYSTEM CONFIGURATION</span><button className="icon-button" aria-label="Close settings" onClick={closeSettings}><Icon kind="close"/></button></div><h2>Make it your own.</h2><label className="setting">Graphics quality<select value={settings.quality} onChange={e => setSettings({ ...settings, quality: e.target.value as Settings['quality'] })}><option value="low">Low · Performance</option><option value="medium">Medium · Balanced</option><option value="high">High · Atmosphere</option></select></label><label className="setting">Sound effects <input aria-label="Sound effects volume" type="range" min="0" max="1" step=".05" value={settings.volume} onChange={e => { audio.unlock(); setSettings({ ...settings, volume: +e.target.value }); }}/></label><label className="setting">Music <input aria-label="Music volume" type="range" min="0" max=".5" step=".025" value={settings.music} onChange={e => { audio.unlock(); setSettings({ ...settings, music: +e.target.value }); }}/></label><label className="setting">Reduced motion<input type="checkbox" checked={settings.reducedMotion} onChange={e => setSettings({ ...settings, reducedMotion: e.target.checked })}/></label><label className="setting">Damage numbers<input type="checkbox" checked={settings.damageNumbers} onChange={e => setSettings({ ...settings, damageNumbers: e.target.checked })}/></label><button className="primary full" onClick={closeSettings}>SAVE & RETURN<Icon kind="arrow"/></button></section></div>}
  {help && <div className="overlay"><section className="modal manual" role="dialog" aria-modal="true" aria-label="Field manual"><div className="modal-heading"><span className="eyebrow">FIELD MANUAL / 001</span><button className="icon-button" aria-label="Close field manual" onClick={() => setHelp(false)}><Icon kind="close"/></button></div><h2>A little strategy.<br />A lot of firepower.</h2><ol><li><b>Claim the high ground.</b><p>Click a glowing hexagonal site, select a tower, and deploy. You begin with 350 credits.</p></li><li><b>Build a combined defense.</b><p>Lasers stop scouts. Missiles punish groups. Tesla arcs chain. Railguns pierce armor. Cryo slows everything nearby.</p></li><li><b>Invest in your perimeter.</b><p>Click a built tower for three upgrades or a 70% recycling refund. Kills and completed waves earn credits.</p></li><li><b>Keep the reactor alive.</b><p>Survive 20 waves. Bosses arrive every fifth wave, use EMPs, and inflict five reactor damage if they break through.</p></li></ol><p className="manual-controls">WASD pan · Right-drag rotate · Scroll zoom · Space start/pause · 1/2/3 speed · Home reset camera · Escape cancel/pause</p><button className="primary full" onClick={() => { setHelp(false); if (game.paused)
        game.togglePause(); }}>UNDERSTOOD<Icon kind="arrow"/></button></section></div>}
  {confirmRestart && <div className="overlay"><div className="modal"><h2>Restart operation?</h2><p>Your current defenses and wave progress will reset.</p><button className="primary full" onClick={start}>RESTART</button><button className="secondary full" onClick={() => setConfirmRestart(false)}>KEEP PLAYING</button></div></div>}
  {error && <div className="overlay"><div className="modal"><h2>Graphics unavailable</h2><p>{error}</p><p>Use a desktop browser with WebGL 2 and hardware acceleration enabled.</p><button className="primary full" onClick={() => location.reload()}>RELOAD</button></div></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
