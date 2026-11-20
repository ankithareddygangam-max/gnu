import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Compass, MapPin, Search, Ticket, Users, Zap } from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'https://gnu-d7vm.onrender.com').replace(/\/$/, '');
const dateFmt = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
const palettes = [
  ['#6554f4','#b8afff'], ['#0a8892','#9bf2e8'], ['#cf6549','#ffc2a8'], ['#8b55bf','#e2beff'], ['#2b7b59','#a9efc4']
];

function App() {
  const [events, setEvents] = useState([]), [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [tab, setTab] = useState('explore'), [query, setQuery] = useState(''), [category, setCategory] = useState('All events');
  const [userId, setUserId] = useState(() => localStorage.getItem('campuspulse-user') || '');
  const [draftUser, setDraftUser] = useState(userId), [busy, setBusy] = useState(''), [notice, setNotice] = useState('');

  async function loadEvents() {
    setLoading(true); setError('');
    try { const r = await fetch(`${API}/api/events`); if (!r.ok) throw new Error(`Events request failed (${r.status})`); setEvents(await r.json()); }
    catch (e) { setError(`${e.message}. The API may be waking up; try again in a moment.`); }
    finally { setLoading(false); }
  }
  async function loadRegistrations(id = userId) {
    if (!id) { setRegistrations([]); return; }
    try { const r = await fetch(`${API}/api/me/registrations?user_id=${encodeURIComponent(id)}`); if (!r.ok) throw new Error(); setRegistrations(await r.json()); }
    catch { setNotice('Could not load registrations. Check the user ID and try again.'); }
  }
  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { loadRegistrations(); }, [userId]);
  const categories = useMemo(() => ['All events', ...new Set(events.map(e => e.category).filter(Boolean))], [events]);
  const filtered = events.filter(e => (category === 'All events' || e.category === category) && `${e.title} ${e.description || ''} ${e.location || ''}`.toLowerCase().includes(query.toLowerCase()));
  async function register(event) {
    if (!userId) { setNotice('Add your user ID in the profile field above to register.'); return; }
    setBusy(event.id); setNotice('');
    try {
      const r = await fetch(`${API}/api/registrations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, event_id: event.id }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Registration failed');
      setNotice(`You’re registered for ${event.title}.`); await loadRegistrations();
    } catch (e) { setNotice(e.message); } finally { setBusy(''); }
  }
  function saveUser(e) { e.preventDefault(); const value = draftUser.trim(); setUserId(value); localStorage.setItem('campuspulse-user', value); setNotice(value ? 'User ID saved on this device.' : 'User ID cleared.'); }
  const registeredIds = new Set(registrations.map(r => r.event_id));
  const shown = tab === 'mine' ? events.filter(e => registeredIds.has(e.id)) : filtered;

  return <><header className="topbar"><a className="brand" href="#top"><span className="brand-icon"><Zap size={20} fill="currentColor"/></span><span><b>CampusPulse</b><small>LIVE CAMPUS NODE</small></span></a><nav><button className={tab==='explore'?'active':''} onClick={()=>setTab('explore')}><Compass size={16}/> Explore</button><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}><Ticket size={16}/> My registrations <span className="count">{registrations.length}</span></button></nav><form className="user-form" onSubmit={saveUser}><label htmlFor="user-id">USER ID</label><input id="user-id" value={draftUser} onChange={e=>setDraftUser(e.target.value)} placeholder="Paste your user ID"/><button title="Save user ID"><Check size={15}/></button></form></header>
    <main id="top"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse"/> YOUR CAMPUS, IN MOTION</div><h1>Make room for<br/><em>what’s next.</em></h1><p>Find your people. Discover what’s happening. Make this semester count.</p><button className="hero-cta" onClick={()=>{setTab('explore');document.getElementById('events')?.scrollIntoView({behavior:'smooth'});}}>Explore events <ArrowRight size={17}/></button></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-glow"/><span className="art-star star-a">✳</span><span className="art-star star-b">✦</span><div className="art-card"><CalendarDays/><small>THE CAMPUS CALENDAR</small><strong>Good things<br/>are happening.</strong><span>Find your next moment <ArrowRight size={14}/></span></div><span className="art-pill">✦  THIS WEEK</span></div><div className="hero-foot"><span><b>{events.length || '—'}</b> events to explore</span><span>BUILT FOR CAMPUS LIFE <span className="cyan">✳</span></span></div></section>
      <section id="events" className="events-section"><div className="section-head"><div><div className="eyebrow muted">THE CAMPUS CALENDAR</div><h2>{tab==='mine'?'Your registrations':'Find your next thing.'}</h2></div><span className="live-tag"><i/> LIVE FEED</span></div>
        {tab==='explore'&&<div className="filters"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search events, places, vibes..."/></div><div className="select-wrap"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><ChevronDown size={15}/></div></div>}
        {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}{error&&<div className="notice error">{error}<button onClick={loadEvents}>Try again</button></div>}
        {loading?<div className="empty"><span className="loader"/>Loading the campus feed…</div>:shown.length===0?<div className="empty"><span className="empty-icon">✳</span><h3>{tab==='mine'?'Your list is waiting.':'No events found.'}</h3><p>{tab==='mine'?'Register for something that catches your eye.':'Try another search or check back soon.'}</p></div>:<div className="event-grid">{shown.map((event,i)=>{const [color,light]=palettes[i%palettes.length], full=event.capacity!=null&&Number(event.capacity)<=0, registered=registeredIds.has(event.id);return <article className="event-card" key={event.id}><div className="event-cover" style={{'--cover':color,'--light':light}}><span className="cover-label">{event.category||'CAMPUS EVENT'}</span><span className="cover-mark">{['✳','✦','◈','✷','✺'][i%5]}</span><span className="cover-bottom">CAMPUSPULSE <span>NO. {String(i+1).padStart(2,'0')}</span></span></div><div className="event-body"><div className="event-date"><CalendarDays size={14}/>{event.date?dateFmt.format(new Date(event.date)):event.starts_at?dateFmt.format(new Date(event.starts_at)):'DATE TBA'}</div><h3>{event.title}</h3><div className="event-meta">{event.location&&<span><MapPin size={14}/>{event.location}</span>}{event.time&&<span><Clock3 size={14}/>{event.time}</span>}</div>{event.description&&<p className="description">{event.description}</p>}<div className="event-bottom"><span className="capacity"><Users size={14}/>{event.capacity==null?'Open event':`${event.capacity} spots`}</span><button className={`register ${registered?'registered':''}`} disabled={busy===event.id||full||registered} onClick={()=>register(event)}>{busy===event.id?'Joining…':registered?<><Check size={14}/> Joined</>:full?'Full':<>Register <ArrowRight size={14}/></>}</button></div></div></article>})}</div>}
      </section><footer><a className="brand" href="#top"><span className="brand-icon"><Zap size={17} fill="currentColor"/></span><b>CampusPulse</b></a><span>Made for the moments between classes.</span><span className="api-status"><i/> CONNECTED TO CAMPUS API</span></footer></main></>;
}
createRoot(document.getElementById('root')).render(<App/>);
