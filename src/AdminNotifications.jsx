import React, {useEffect, useRef, useState} from 'react';
import {Bell, X, Volume2, VolumeX, CheckCheck, ArrowUpRight, RefreshCw} from 'lucide-react';
import {useCommerce} from './Commerce';
import './admin-notifications.css';

const empty = () => ({items: [], seen: [], cursor: null, initialized: false});
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
const time = value => new Date(value).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});

export default function AdminNotifications() {
  const c = useCommerce();
  const api = useRef(c.api); api.current = c.api;
  const [data, setData] = useState(empty), [open, setOpen] = useState(false), [popups, setPopups] = useState([]);
  const [connection, setConnection] = useState('Connecting…'), [sound, setSound] = useState(false), [desktop, setDesktop] = useState(false), [message, setMessage] = useState(''), [expired, setExpired] = useState(false);
  const audio = useRef(null), soundOn = useRef(false), desktopOn = useRef(false), memory = useRef(empty()), pollNow = useRef(() => {});
  const panel = useRef(null), bell = useRef(null), wasAdmin = useRef(false), signedOut = useRef(false);
  const key = 'aanch-admin-alerts-v1:' + (c.adminEmail || '');
  const prefs = 'aanch-admin-alert-preferences';

  async function chime() {
    if (!soundOn.current || !audio.current || audio.current.state !== 'running') return;
    const ctx = audio.current;
    // Short, warm two-note chime generated locally; no audio file download.
    for (const [offset, hz] of [[0, 659.25], [.19, 880]]) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + offset;
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.16, at + .015); gain.gain.exponentialRampToValueAtTime(.001, at + .34);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(at); oscillator.stop(at + .36);
    }
  }
  async function toggleSound() {
    if (soundOn.current && audio.current?.state === 'running') {
      soundOn.current = false; setSound(false); save(prefs, {...read(prefs, {}), sound:false}); return;
    }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error();
      audio.current ||= new Audio(); audio.current.onstatechange = () => setSound(soundOn.current && audio.current?.state === 'running'); await audio.current.resume();
      if (audio.current.state !== 'running') throw Error();
      soundOn.current = true; setSound(true); save(prefs, {...read(prefs, {}), sound:true}); await chime(); setMessage('Sound is on. Keep this site open and your device volume audible.');
    } catch { setMessage('Audio is blocked on this device. Try enabling sound again.'); }
  }
  async function enableDesktop() {
    if (!('Notification' in window)) { setMessage('This browser does not support desktop alerts. In-site alerts remain available.'); return; }
    try {
      const permission = await Notification.requestPermission();
      desktopOn.current = permission === 'granted'; setDesktop(desktopOn.current);
      save(prefs, {...read(prefs, {}), desktop: desktopOn.current});
      setMessage(desktopOn.current ? 'Desktop alerts enabled while this site is running.' : 'Desktop alerts were not allowed. You can change this in browser site settings.');
    } catch { setMessage('Desktop alerts are unavailable here. In-site alerts remain active.'); }
  }
  function update(next) { memory.current = next; setData(next); save(key, next); }
  function markRead(eventKey) {
    const latest = read(key, memory.current);
    update({...latest, items:latest.items.map(item => !eventKey || item.key === eventKey ? {...item, read:true} : item)});
  }
  function view(item) { markRead(item.key); setOpen(false); setPopups(old => old.filter(p => p.key !== item.key)); location.hash = item.href + '?ref=' + encodeURIComponent(item.reference); window.dispatchEvent(new Event('aanch:requests-changed')); }

  async function announce(arrivals) {
    if (!arrivals.length) return;
    setPopups(old => [...arrivals.slice(-3), ...old.filter(p => !arrivals.some(a => a.key === p.key))].slice(0,3));
    window.dispatchEvent(new Event('aanch:requests-changed'));
    const notify = async () => {
      const claimsKey = key + ':announced';
      const claims = read(claimsKey, {sound:[], desktop:[]});
      if (soundOn.current && audio.current?.state === 'running' && arrivals.some(a => !claims.sound.includes(a.key))) {
        claims.sound = [...claims.sound, ...arrivals.map(a => a.key)].slice(-1000);
        save(claimsKey, claims); await chime();
      }
      if (desktopOn.current && document.hidden && arrivals.some(a => !claims.desktop.includes(a.key))) {
        try {
          const n = new Notification(arrivals.length > 1 ? `${arrivals.length} new restaurant requests` : arrivals[0].title, {body:arrivals.length > 1 ? 'Open Aanch to review your restaurant desk.' : arrivals[0].reference, tag:'aanch-new-requests', silent:true});
          claims.desktop = [...claims.desktop, ...arrivals.map(a => a.key)].slice(-1000); save(claimsKey, claims);
          n.onclick = () => { window.focus(); view(arrivals[0]); n.close(); };
          setTimeout(() => n.close(), 15000);
        } catch { /* In-site alerts remain available on unsupported browsers. */ }
      }
    };
    // Share one audible chime across tabs that have enabled sound.
    if (navigator.locks) await navigator.locks.request(key + ':announce', notify);
    else await notify();
  }

  useEffect(() => {
    if (c.admin) { wasAdmin.current = true; signedOut.current = false; }
    else if (wasAdmin.current) { setExpired(!signedOut.current); wasAdmin.current = false; }
  }, [c.admin]);
  useEffect(() => {
    const logout = () => { signedOut.current = true; setExpired(false); try { localStorage.removeItem(key); localStorage.removeItem(key + ':announced'); } catch {} };
    window.addEventListener('aanch:admin-signed-out', logout);
    return () => window.removeEventListener('aanch:admin-signed-out', logout);
  }, [key]);

  useEffect(() => {
    if (!c.admin) {
      setOpen(false); setPopups([]); setData(empty()); memory.current = empty();
      soundOn.current = false; setSound(false); audio.current?.close().catch(() => {}); audio.current = null;
      return;
    }
    setExpired(false);
    let stopped = false, timer, busy = false;
    const cached = read(key, empty()); memory.current = cached; setData(cached);
    const preferences = read(prefs, {});
    desktopOn.current = Boolean(preferences.desktop && 'Notification' in window && Notification.permission === 'granted'); setDesktop(desktopOn.current);
    if (preferences.sound) setMessage('Click Enable sound to resume audible alerts after reopening this page.');
    async function poll() {
      if (busy || stopped) return;
      clearTimeout(timer);
      if (!navigator.onLine) { setConnection('Offline · reconnecting automatically'); timer = setTimeout(poll, 10000); return; }
      busy = true;
      try {
        const current = read(key, memory.current);
        const response = await api.current('/admin/notifications' + (current.cursor ? '?cursor=' + encodeURIComponent(JSON.stringify(current.cursor)) : ''));
        if (stopped) return;
        // Re-read after the request so another tab's arrivals/read state are retained.
        const latest = read(key, memory.current), seen = new Set(latest.seen);
        const fresh = response.events.filter(event => !seen.has(event.key));
        const arrivals = fresh.filter(event => event.status === 'requested');
        const items = [...arrivals.map(event => ({...event, read:false})), ...latest.items].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,100);
        const next = {...latest, items, seen:[...latest.seen, ...fresh.map(event => event.key)].slice(-10000), cursor:response.cursor, initialized:latest.initialized || !response.hasMore};
        update(next); setConnection(document.hidden ? 'Connected · background checks may be delayed' : 'Live · checks every 5 seconds');
        if (latest.initialized && arrivals.length) await announce(arrivals);

        timer = setTimeout(poll, response.hasMore ? 100 : 5000);
      } catch (error) {
        if ([401,403].includes(error.status)) { setExpired(true); return; }
        if (!stopped) { setConnection('Connection interrupted · retrying'); timer = setTimeout(poll, 10000); }
      } finally { busy = false; }
    }
    const sync = event => { if (event.key === key && event.newValue) { const previous = memory.current; const value = read(key, previous); memory.current = value; setData(value); if (previous.initialized) announce(value.items.filter(item => !previous.seen.includes(item.key))).catch(() => {}); } };
    const wake = () => { if (!document.hidden && soundOn.current) audio.current?.resume().catch(() => {}); poll(); };
    pollNow.current = poll; poll();
    window.addEventListener('storage', sync); window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener('storage', sync); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [c.admin, key]);

  useEffect(() => {
    if (!open) return;
    const close = event => { if (event.key === 'Escape') { setOpen(false); bell.current?.focus(); } };
    const outside = event => { if (!panel.current?.contains(event.target) && !bell.current?.contains(event.target)) setOpen(false); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => { if (!popups.length) return; const timer = setTimeout(() => setPopups([]), 15000); return () => clearTimeout(timer); }, [popups]);
  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);

  if (!c.admin) return expired ? <div className="admin-alert-dock"><a className="admin-alert-expired" href="#/admin/login">Restaurant alerts paused · Sign in again</a></div> : null;
  const unread = data.items.filter(item => !item.read).length;
  return <>
    <div className="admin-alert-dock">
      <button ref={bell} className="admin-alert-bell" onClick={() => setOpen(!open)} aria-label={`Restaurant notifications, ${unread} unread`} aria-expanded={open} aria-controls="restaurant-alerts"><Bell size={20}/><span>Restaurant alerts</span>{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</button>
      {!sound && <button className="admin-alert-enable" onClick={toggleSound}><Volume2 size={16}/>Enable sound</button>}
    </div>
    {open && <section ref={panel} id="restaurant-alerts" className="admin-alert-panel" aria-label="Restaurant notifications">
      <div className="admin-alert-heading"><div><small>RESTAURANT DESK</small><h2>Notifications <span>{unread} unread</span></h2></div><button aria-label="Close notifications" onClick={() => {setOpen(false); bell.current?.focus();}}><X size={20}/></button></div>
      <p className="admin-alert-connection" role="status">{connection}</p>
      <div className="admin-alert-settings"><button onClick={toggleSound}>{sound ? <Volume2 size={16}/> : <VolumeX size={16}/>} {sound ? 'Mute sound' : 'Enable sound'}</button><button onClick={enableDesktop}>{desktop ? 'Desktop alerts on' : 'Enable desktop alerts'}</button><button onClick={() => pollNow.current()} aria-label="Refresh notifications"><RefreshCw size={16}/></button></div>
      {message && <p className="admin-alert-hint" role="status">{message}</p>}
      <div className="admin-alert-list-head"><span>Recent requests · last 24h on first login</span><button onClick={() => markRead()} disabled={!unread}><CheckCheck size={15}/>Mark all read</button></div>
      <div className="admin-alert-list">{!data.items.length ? <div className="admin-alert-empty"><Bell size={30}/><h3>Your restaurant desk is listening.</h3><p>New tables, food pre-orders and online orders will appear here.</p></div> : data.items.map(item => <button className={item.read ? '' : 'unread'} key={item.key} onClick={() => view(item)}><span className="admin-alert-dot"/><div><strong>{item.title}</strong><p>{item.name} · {item.reference}</p><p>{item.detail}</p><small>{time(item.createdAt)} · View request ↗</small></div></button>)}</div>
      <p className="admin-alert-footnote">Keep this site open, your device awake and volume on for sound. Alerts stop when your admin session expires or you sign out.</p>
    </section>}
    <div className="admin-alert-popups" aria-live="polite" aria-atomic="false">{popups.map(item => <article key={item.key}><Bell size={22}/><div><strong>{item.title}</strong><p>{item.name} · {item.reference}</p><p>{item.detail}</p><button onClick={() => view(item)}>View request <ArrowUpRight size={16}/></button></div><button aria-label="Dismiss notification" onClick={() => setPopups(old => old.filter(p => p.key !== item.key))}><X size={18}/></button></article>)}</div>
  </>;
}
