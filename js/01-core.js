/* ==========================================================================
   MovieMind AI — 01 core
   Catalogue + streams come from the Internet Archive (public domain /
   openly licensed). MovieMind needs NO API key to work.
   ========================================================================== */

const IA       = 'https://archive.org';
const IMG      = id => `${IA}/services/img/${encodeURIComponent(id)}`;
const DETAILS  = id => `${IA}/details/${encodeURIComponent(id)}`;
const FILE_URL = (id, name) =>
  `${IA}/download/${encodeURIComponent(id)}/` + name.split('/').map(encodeURIComponent).join('/');

const FIELDS = ['identifier','title','year','date','downloads','subject','creator',
                'description','mediatype','collection','language','runtime','licenseurl'];
const BASE   = 'mediatype:(movies) AND -collection:(tvnews OR radioprograms OR podcasts OR audio OR etree)';

const LS = { watch:'mm.watchlist.v1', cont:'mm.continue.v1', set:'mm.settings.v1' };

/* ------------------------------------------------- curated, pre-verified set */
const CURATED = [
  {id:'Night.Of.The.Living.Dead_1080p',           title:'Night of the Living Dead',   year:1968, tag:'Horror'},
  {id:'plan-9-from-outer-space',                  title:'Plan 9 from Outer Space',    year:1959, tag:'Sci-Fi'},
  {id:'Nosferatu_most_complete_version_93_mins.', title:'Nosferatu',                  year:1922, tag:'Silent Horror'},
  {id:'his_girl_friday',                          title:'His Girl Friday',            year:1940, tag:'Screwball Comedy'},
  {id:'TheGeneral_201312',                        title:'The General',                year:1926, tag:'Silent Comedy'},
  {id:'Metropolis1927EnglishVersion',             title:'Metropolis',                 year:1927, tag:'Sci-Fi'},
  {id:'Detour',                                   title:'Detour',                     year:1945, tag:'Film Noir'},
  {id:'CarnivalofSouls',                          title:'Carnival of Souls',          year:1962, tag:'Horror'},
  {id:'the-stranger-1946_202404',                 title:'The Stranger',               year:1946, tag:'Noir Thriller'},
  {id:'ScarletStreet',                            title:'Scarlet Street',             year:1945, tag:'Film Noir'},
  {id:'suddenly',                                 title:'Suddenly',                   year:1954, tag:'Noir Thriller'},
  {id:'Sita_Sings_the_Blues',                     title:'Sita Sings the Blues',       year:2008, tag:'Animation'},
  {id:'house_on_haunted_hill_ipod',               title:'House on Haunted Hill',      year:1959, tag:'Horror'},
  {id:'TheLastManOnEarthHD',                      title:'The Last Man on Earth',      year:1964, tag:'Sci-Fi Horror'},
  {id:'BattleshipPotemkin',                       title:'Battleship Potemkin',        year:1925, tag:'Silent Drama'},
  {id:'ATripToTheMoonGeorgeMelies',               title:'A Trip to the Moon',         year:1902, tag:'Short'},
  {id:'doa_ipod',                                 title:'D.O.A.',                     year:1955, tag:'Film Noir'},
  {id:'sherlockjr1924_201909',                    title:'Sherlock Jr.',               year:1924, tag:'Silent Comedy'},
  {id:'TheLittleShopOfHorrors1960_765',           title:'The Little Shop of Horrors', year:1960, tag:'Comedy Horror'},
  {id:'JungleBook',                               title:'Jungle Book',                year:1942, tag:'Family'},
  {id:'reefer_madness1938',                       title:'Reefer Madness',             year:1938, tag:'Cult'},
  {id:'gulliverstravels1939',                     title:"Gulliver's Travels",         year:1939, tag:'Animation'},
  {id:'PopeyeAliBaba',                            title:'Popeye Meets Ali Baba',      year:1937, tag:'Cartoon'}
];

/* ---------------------------------------------------------------- browse rows */
const ROWS = [
  {key:'noir',      title:'Film Noir & Crime',          sub:'Rain, fedoras, bad decisions',
   q:`collection:(Film_Noir) AND ${BASE}`},
  {key:'silent',    title:'The Silent Era',             sub:'Before anyone could talk back',
   q:`collection:(silent_films) AND ${BASE}`},
  {key:'scifi',     title:'Sci-Fi & Creature Features', sub:'Rockets, mutants and B-movie monsters',
   q:`collection:(SciFi_Horror) AND ${BASE}`},
  {key:'horror',    title:'Horror Classics',            sub:'The ones that started it all',
   q:`${BASE} AND (horror OR zombie OR vampire OR haunted OR monster) AND year:[1920 TO 1985]`},
  {key:'comedy',    title:'Comedy & Slapstick',         sub:'Chaplin, Keaton and the rest',
   q:`${BASE} AND (comedy OR slapstick OR hilarious OR funny) AND year:[1915 TO 1975]`},
  {key:'hollywood', title:'Hollywood Classics',         sub:'The golden-age archive',
   q:`collection:(feature_films) AND ${BASE} AND year:[1930 TO 1970]`},
  {key:'cartoon',   title:'Cartoons & Animation',       sub:'Hand-drawn, frame by frame',
   q:`${BASE} AND (cartoon OR animation OR animated) AND year:[1920 TO 1965]`},
  {key:'shorts',    title:'Short Films',                sub:'Under an hour, straight to the point',
   q:`collection:(short_films) AND ${BASE}`},
  {key:'western',   title:'Westerns & Adventure',       sub:'Frontier towns and high seas',
   q:`${BASE} AND (western OR cowboy OR adventure OR pirate) AND year:[1920 TO 1975]`},
  {key:'scifi50',   title:'1950s Science Fiction',      sub:'Atomic-age anxieties',
   q:`${BASE} AND (sci-fi OR "science fiction" OR alien OR space) AND year:[1950 TO 1959]`},
  {key:'tv',        title:'Classic Television',         sub:'Episodes from the early networks',
   q:`collection:(classic_tv) AND ${BASE}`},
  {key:'family',    title:'Family Matinee',             sub:'Fine for everyone in the room',
   q:`${BASE} AND (family OR children OR fairy OR adventure) AND year:[1930 TO 1975]`}
];

/* --------------------------------------------------------- the AI intent map */
const GENRES = {
  'Horror':          ['horror','scary','scared','frightening','creepy','spooky','terrifying','zombie','zombies','vampire','vampires','ghost','ghosts','haunted','slasher','monster','monsters','gore','eerie'],
  'Science Fiction': ['sci-fi','scifi','science fiction','space','spaceship','alien','aliens','futuristic','robot','robots','cyborg','apocalypse','post-apocalyptic','dystopian','martian'],
  'Comedy':          ['comedy','comedies','funny','hilarious','laugh','laughs','silly','slapstick','humour','humor','screwball','farce','witty'],
  'Drama':           ['drama','dramatic','emotional','moving','serious','tearjerker','tragic','tragedy'],
  'Romance':         ['romance','romantic','love','rom-com','romcom','swoon'],
  'Film Noir':       ['noir','detective','detectives','private eye','hard-boiled','hardboiled','crime','criminal','gangster','mob','heist','whodunit','murder','femme fatale','sleuth'],
  'Thriller':        ['thriller','suspense','tense','chilling','psychological'],
  'Western':         ['western','westerns','cowboy','cowboys','gunslinger','frontier','wild west','sheriff'],
  'Animation':       ['animation','animated','cartoon','cartoons','anime','drawn'],
  'Adventure':       ['adventure','action','epic','quest','swashbuckler','pirate','pirates','treasure','jungle'],
  'Musical':         ['musical','musicals','singing','songs','dance','dancing'],
  'Family':          ['family','kids','children','wholesome','kid-friendly','all ages'],
  'War':             ['war','wartime','battle','soldier','soldiers','wwii','ww2'],
  'Mystery':         ['mystery','mysteries','puzzle','riddle','whodunnit'],
  'Documentary':     ['documentary','documentaries','non-fiction'],
  'Fantasy':         ['fantasy','magic','magical','fairy tale','dragons','mythical'],
  'Silent':          ['silent','mute']
};
const GENRE_QUERY = {
  'Horror':'(horror OR scary OR zombie OR vampire OR haunted OR monster)',
  'Science Fiction':'(sci-fi OR "science fiction" OR alien OR space OR robot OR apocalypse)',
  'Comedy':'(comedy OR slapstick OR funny OR humorous)',
  'Drama':'(drama OR dramatic)',
  'Romance':'(romance OR romantic OR love)',
  'Film Noir':'(noir OR detective OR crime OR gangster)',
  'Thriller':'(thriller OR suspense)',
  'Western':'(western OR cowboy OR frontier)',
  'Animation':'(cartoon OR animation OR animated OR puppet)',
  'Adventure':'(adventure OR pirate OR treasure OR jungle)',
  'Musical':'(musical OR music OR singing OR dance)',
  'Family':'(family OR children OR "fairy tale")',
  'War':'(war OR battle OR soldier)',
  'Mystery':'(mystery OR detective OR whodunit)',
  'Documentary':'(documentary OR actualities)',
  'Fantasy':'(fantasy OR magic OR mythical)'
};
const DECADE_WORDS = { twenties:1920, thirties:1930, forties:1940, fifties:1950,
  sixties:1960, seventies:1970, eighties:1980, nineties:1990 };
const STOP = new Set(['a','an','the','of','for','with','and','or','to','in','on','at','is','are',
  'i','me','my','some','something','anything','movie','movies','film','films','watch','watching',
  'about','that','this','want','wanna','like','really','very','good','great','best','please',
  'find','show','give','recommend','recommendation','suggest','suggestion','night','tonight',
  'any','it','its','was','were','be','can','could','would','should','from','by','as','set','old']);

/* ------------------------------------------------------------------- storage */
const store = {
  get(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return (v === null || v === undefined) ? d : v; } catch (e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e){} }
};
let watchlist = store.get(LS.watch, []);
let history   = store.get(LS.cont, []);
let settings  = store.get(LS.set, { tmdb:'', llm:'', endpoint:'' });

/* --------------------------------------------------------------------- utils */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

function esc(s){
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function stripHtml(s){
  if (!s) return '';
  if (Array.isArray(s)) s = s.join(' ');
  const d = document.createElement('div');
  d.innerHTML = String(s);
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}
function cleanTitle(raw){
  let t = stripHtml(raw) || 'Untitled';
  t = t.replace(/\s*[[(]\s*(1[89]|20)\d{2}\s*[\])]\s*$/,'');
  t = t.replace(/^(full movie|movie)\s*[:\-]\s*/i,'');
  t = t.replace(/\s*[-\u2013|]\s*(full movie|hd|1080p|720p|remaster(ed)?)\s*$/i,'');
  t = t.replace(/^["'\u201c\u201d\u00ab\u00bb]+|["'\u201c\u201d\u00ab\u00bb]+$/g,'').replace(/\s{2,}/g,' ').trim();
  return t || 'Untitled';
}
function pickYear(doc){
  const direct = parseInt(doc.year, 10);
  if (direct > 1880 && direct < 2100) return direct;
  const fromDate = /((?:18|19|20)\d{2})/.exec(doc.date || doc.publicdate || '');
  if (fromDate) return parseInt(fromDate[1], 10);
  const fromTitle = /\(((?:18|19|20)\d{2})\)/.exec(doc.title || '');
  if (fromTitle) return parseInt(fromTitle[1], 10);
  return null;
}
function toMovie(doc){
  const subj = Array.isArray(doc.subject) ? doc.subject
             : doc.subject ? String(doc.subject).split(/[;,]/) : [];
  return {
    id: doc.identifier,
    title: cleanTitle(doc.title),
    year: pickYear(doc),
    downloads: Number(doc.downloads) || 0,
    subjects: subj.map(s => String(s).trim()).filter(Boolean).slice(0, 12),
    creator: stripHtml(doc.creator).slice(0, 90),
    description: stripHtml(doc.description).slice(0, 900),
    runtime: doc.runtime || '',
    poster: IMG(doc.identifier),
    source: DETAILS(doc.identifier)
  };
}
function nfmt(n){
  if (!n) return '';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}
function toast(msg, ms){
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.hidden = true; }, ms || 2600);
}

/* --------------------------------------------------------------- API helpers */
async function apiSearch(q, opts){
  opts = opts || {};
  const p = new URLSearchParams();
  p.append('q', q);
  p.append('output', 'json');
  p.append('rows', opts.rows || 24);
  p.append('page', opts.page || 1);
  p.append('sort[]', opts.sort || 'downloads desc');
  FIELDS.forEach(f => p.append('fl[]', f));
  const r = await fetch(IA + '/advancedsearch.php?' + p, { headers:{ 'Accept':'application/json' } });
  if (!r.ok) throw new Error('Archive search failed (' + r.status + ')');
  const j = await r.json();
  return {
    total: (j && j.response && j.response.numFound) || 0,
    movies: ((j && j.response && j.response.docs) || []).map(toMovie)
  };
}
async function apiMeta(id){
  const r = await fetch(IA + '/metadata/' + encodeURIComponent(id));
  if (!r.ok) throw new Error('Could not load this title (' + r.status + ')');
  return r.json();
}

/* --------------------------------------------- resolve the best playable file */
const EXT_RANK = { mp4:0, webm:1, ogv:2, mkv:3 };
const FMT_RANK = { 'h.264 IA':0, 'h.264':1, 'MPEG4':2, '512Kb MPEG4':3, 'hi-res MPEG4':4,
                   'WebM':5, 'Ogg Video':6, 'MPEG2':7, 'Matroska':8, 'QuickTime':9 };
const JUNK = /trailer|sample|preview|_thumbs|spectrogram/i;

function rankVideos(files){
  const arr = (files || []).filter(f => /\.(mp4|webm|ogv|mkv)$/i.test(f.name || ''));
  const sc = f => {
    const e = f.name.split('.').pop().toLowerCase();
    return (EXT_RANK[e] === undefined ? 9 : EXT_RANK[e]);
  };
  arr.sort(function(a, b){
    const fa = FMT_RANK[a.format] === undefined ? 50 : FMT_RANK[a.format];
    const fb = FMT_RANK[b.format] === undefined ? 50 : FMT_RANK[b.format];
    return (sc(a) - sc(b)) || (fa - fb) || ((+b.size || 0) - (+a.size || 0));
  });
  return arr;
}
function pickVideo(files){
  const all  = rankVideos(files);
  const big  = all.filter(f => !JUNK.test(f.name) && (+f.size || 0) > 3000000);
  const anyN = all.filter(f => !JUNK.test(f.name));
  return big[0] || anyN[0] || all[0] || null;
}
function pickSub(files){
  const subs = (files || []).filter(f => /\.(srt|vtt)$/i.test(f.name || ''));
  if (!subs.length) return null;
  subs.sort((a, b) => (+b.size || 0) - (+a.size || 0));
  return subs.find(s => /english|en[-_.]|\.en\./i.test(s.name)) || subs[0];
}

/* The subtitle bridge (/api/captions) only exists when the local helper server
   is running on 127.0.0.1. Hosted on the web, that bridge is absent - the rest
   of the app talks to archive.org directly and works everywhere. */
const IS_LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const HAS_SERVER   = IS_LOCALHOST && /^https?:$/.test(location.protocol);

async function resolveItem(id){
  const meta = await apiMeta(id);
  if (meta.is_dark) throw new Error('This title has been withdrawn from the public archive.');
  const files = meta.files || [];
  const v = pickVideo(files);
  if (!v) throw new Error('No browser-playable video file is attached to this title.');
  const sub = pickSub(files);
  const m = meta.metadata || {};
  const subj = Array.isArray(m.subject) ? m.subject
             : m.subject ? String(m.subject).split(/[;,]/) : [];
  return {
    id: id,
    videoUrl: FILE_URL(id, v.name),
    fileName: v.name,
    sizeMB: v.size ? Math.round(+v.size / 1048576) : null,
    length: v.length || '',
    subUrl: sub ? FILE_URL(id, sub.name) : null,
    subName: sub ? sub.name : null,
    description: stripHtml(m.description).slice(0, 1400),
    creator: stripHtml(m.creator).slice(0, 120),
    license: m.licenseurl || '',
    title: cleanTitle(m.title || id),
    year: pickYear(m),
    subjects: subj.map(s => String(s).trim()).filter(Boolean).slice(0, 14),
    collection: Array.isArray(m.collection) ? m.collection : (m.collection ? [m.collection] : []),
    source: DETAILS(id),
    poster: IMG(id)
  };
}
