/* ==========================================================================
   MovieMind AI — 03 UI
   Cards, rows, views, browse/search results, watchlist, detail modal.
   ========================================================================== */

let heroPick      = CURATED[0];
let currentQuery  = null;
let currentIntent = null;
let currentPage   = 1;
let gridMovies    = [];
let currentKind   = 'home';     /* home | search | browse */
let rowObserver   = null;

/* ------------------------------------------------------------------ cards */
function imgFallback(img, title){
  img.addEventListener('error', function(){
    const p = img.parentElement;
    img.remove();
    if (!p || p.querySelector('.poster-fallback')) return;
    const f = document.createElement('div');
    f.className = 'poster-fallback';
    f.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;' +
      'background:linear-gradient(150deg,#251f45,#100e1d);color:#a99ee0;font-size:34px;font-weight:800;';
    f.textContent = String(title || '?').trim().charAt(0).toUpperCase();
    p.prepend(f);
  }, { once: true });
}

function cardHTML(m, opts){
  opts = opts || {};
  const saved = watchlist.some(w => w.id === m.id);
  const prog  = opts.progress || 0;
  const sub   = [];
  if (m.year) sub.push(String(m.year));
  if (m.downloads) sub.push('<i>' + nfmt(m.downloads) + ' views</i>');
  if (m.runtime) sub.push('<i>' + esc(String(m.runtime).slice(0, 9)) + '</i>');
  return '<div class="card" data-id="' + esc(m.id) + '" role="button" tabindex="0" aria-label="' + esc(m.title) + '">' +
    '<div class="card-art">' +
      (m.tag ? '<span class="badge-tag">' + esc(m.tag) + '</span>' : '') +
      '<img class="card-img" loading="lazy" alt="" src="' + esc(m.poster) + '">' +
      '<span class="card-play">\u25b6</span>' +
      '<button class="card-fav' + (saved ? ' on' : '') + '" data-fav="' + esc(m.id) + '" title="Watchlist">\u2605</button>' +
      (prog > 0 ? '<div class="progress-bar"><i style="width:' + Math.min(100, Math.round(prog * 100)) + '%"></i></div>' : '') +
      '<div class="card-body">' +
        '<p class="card-title">' + esc(m.title) + '</p>' +
        '<p class="card-sub">' + sub.join('<span>\u00b7</span>') + '</p>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function hydrate(container){
  $$('.card-img', container).forEach(function(img){
    const card = img.closest('.card');
    imgFallback(img, card ? (card.getAttribute('aria-label') || '') : '');
    const done = () => img.classList.add('loaded');
    if (img.complete) done(); else img.addEventListener('load', done, { once: true });
  });
}

const skeletonRow = () =>
  '<div class="row"><div class="row-head"><h3>&nbsp;</h3></div><div class="row-scroll">' +
  Array.from({ length: 7 }, () => '<div class="card skeleton"><div class="card-art"></div></div>').join('') +
  '</div></div>';

/* ----------------------------------------------------- continue-watching row */
function continueRow(){
  const items = history.filter(h => h.progress > 0.02 && h.progress < 0.97).slice(0, 12);
  if (!items.length) return '';
  const cards = items.map(h => cardHTML(
    { id:h.id, title:h.title, year:h.year, poster:h.poster, downloads:0, runtime:'' },
    { progress: h.progress }
  )).join('');
  return '<div class="row" data-row="continue"><div class="row-head"><h3>Continue watching</h3>' +
    '<span>Picks up where you left off</span></div><div class="row-scroll">' + cards + '</div></div>';
}

/* ------------------------------------------------------------------- rows */
function renderHomeRows(){
  const wrap = $('#rows');
  wrap.innerHTML = continueRow() +
    '<div class="row" data-row="featured"><div class="row-head"><h3>Featured Classics</h3>' +
    '<span>Hand-picked and verified playable</span></div><div class="row-scroll">' +
    CURATED.map(c => cardHTML({ id:c.id, title:c.title, year:c.year, poster:IMG(c.id),
                                downloads:0, runtime:'', tag:c.tag })).join('') +
    '</div></div>' +
    ROWS.map(() => skeletonRow()).join('');
  hydrate(wrap);

  const rowEls = $$('.row', wrap).filter(el => el.getAttribute('data-row') !== 'featured' &&
                                               el.getAttribute('data-row') !== 'continue');
  rowObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (!en.isIntersecting) return;
      const idx = rowEls.indexOf(en.target);
      if (idx < 0) return;
      rowObserver.unobserve(en.target);
      loadRow(ROWS[idx], en.target);
    });
  }, { rootMargin: '600px 0px' });
  rowEls.forEach(el => rowObserver.observe(el));
}

async function loadRow(row, el){
  try {
    const res = await apiSearch(row.q, { rows: 20, sort: 'downloads desc' });
    const inner = el.querySelector('.row-scroll');
    inner.innerHTML = res.movies.map(m => cardHTML(m)).join('') ||
      '<p class="results-sub">Nothing found in this section.</p>';
    hydrate(el);
  } catch (e){
    el.querySelector('.row-scroll').innerHTML =
      '<p class="results-sub">Could not load this row (' + esc(e.message) + ').</p>';
  }
}

/* ------------------------------------------------------------------- hero */
function setHero(movie){
  heroPick = movie;
  $('#heroBg').style.backgroundImage = 'url("' + movie.poster + '")';
  $('#heroTitle').textContent = movie.title;
  $('#heroTag').textContent = movie.tag || 'Featured';
  $('#heroMeta').textContent = [movie.year, movie.tag, 'Free & legal to stream'].filter(Boolean).join('  \u00b7  ');
  $('#heroBlurb').textContent = movie.blurb ||
    'A hand-picked favourite from the Internet Archive\u2019s public-domain collection. Press play and it streams straight to this page.';
}

/* ---------------------------------------------------------------- results */
function intentChips(intent){
  if (!intent || !intent.notes.length) return '';
  return '<div class="detail-chips" style="margin-top:10px">' +
    intent.notes.map(n => '<span>' + esc(n) + '</span>').join('') + '</div>';
}

function showGrid(movies, opts){
  opts = opts || {};
  gridMovies = movies;
  const grid = $('#grid');
  grid.innerHTML = movies.map(m => cardHTML(m)).join('');
  hydrate(grid);
  $('#loadMore').hidden = !opts.more;
  $('#grid').scrollIntoView({ block: 'nearest' });
}

function goResults(){
  $$('.nav-btn').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-view') === 'browse'));
  showView('browse');
}

async function runAsk(text, opts){
  opts = opts || {};
  let intent = understand(text);
  if (settings.llm && settings.endpoint){
    const extra = await llmUnderstand(text);
    intent = mergeLLM(intent, extra);
  }
  currentIntent = intent;
  currentQuery  = buildQuery(intent);
  currentPage   = 1;
  currentKind   = 'search';
  goResults();

  $('#resultsTitle').textContent = 'Results for \u201c' + text + '\u201d';
  $('#resultsSub').innerHTML = 'Reading your request\u2026';
  $('#grid').innerHTML = Array.from({ length: 12 }, () =>
    '<div class="card skeleton"><div class="card-art"></div></div>').join('');

  try {
    const res = await apiSearch(currentQuery, { rows: 40, sort: 'downloads desc' });
    const ranked = rerank(res.movies, intent).slice(0, 30);
    $('#resultsSub').innerHTML =
      (res.total ? res.total.toLocaleString() + ' titles match in the archive' : 'No direct matches') +
      ' \u00b7 showing the ' + ranked.length + ' best fits' + intentChips(intent);
    if (!ranked.length){
      $('#grid').innerHTML = '';
      $('#loadMore').hidden = true;
      showEmpty(gridMovies.length === 0 ?
        'Nothing matched that. Try describing a mood, a decade, or a genre \u2014 e.g. \u201cspooky 60s horror\u201d.' : '');
      return;
    }
    showGrid(ranked, { more: false });
  } catch (e){
    $('#resultsSub').textContent = 'Something went wrong: ' + e.message;
    $('#grid').innerHTML = '';
  }
}

function showEmpty(msg){
  const grid = $('#grid');
  grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><p class="empty-ico">\ud83c\udfac</p><p>' +
    esc(msg) + '</p></div>';
}

/* --------------------------------------------------------------- browsing */
function currentFilterQuery(){
  const genre = $('#fGenre').value;
  const era   = $('#fDecade').value;
  const type  = $('#fType').value;
  const parts = [BASE];
  if (type === 'short')      parts.push('collection:(short_films)');
  else if (type === 'tv')    parts.push('collection:(classic_tv)');
  else if (type === 'feature') parts.push('collection:(feature_films OR Film_Noir OR SciFi_Horror)');
  else if (type === 'cartoon') parts.push('(cartoon OR animation OR animated)');
  if (genre && GENRE_QUERY[genre]) parts.push('(' + GENRE_QUERY[genre] + ')');
  if (era){
    const bits = era.split('-');
    parts.push('year:[' + bits[0] + ' TO ' + bits[1] + ']');
  }
  return parts.join(' AND ');
}

async function runBrowse(reset){
  if (reset) currentPage = 1;
  currentKind = 'browse';
  goResults();
  $('#resultsTitle').textContent = ($('#fGenre').value || 'Everything') +
    ($('#fDecade').value ? ' \u00b7 ' + $('#fDecade').value.replace('-', '\u2013') : '');
  if (reset){
    $('#resultsSub').textContent = 'Searching\u2026';
    $('#grid').innerHTML = Array.from({ length: 12 }, () =>
      '<div class="card skeleton"><div class="card-art"></div></div>').join('');
  }
  currentQuery = currentFilterQuery();
  try {
    const res = await apiSearch(currentQuery, { rows: 48, page: currentPage, sort: 'downloads desc' });
    let list = res.movies;
    const sort = $('#fSort').value;
    if (sort === 'year-asc')  list = list.slice().sort((a, b) => (a.year || 9999) - (b.year || 9999));
    if (sort === 'year-desc') list = list.slice().sort((a, b) => (b.year || 0) - (a.year || 0));
    if (sort === 'title-asc') list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
    gridMovies = reset ? list : gridMovies.concat(list);
    showGrid(gridMovies, { more: res.total > currentPage * 48 });
    $('#resultsSub').textContent = res.total.toLocaleString() +
      ' titles in the archive \u00b7 showing ' + gridMovies.length;
  } catch (e){
    $('#resultsSub').textContent = 'Something went wrong: ' + e.message;
  }
}

/* -------------------------------------------------------------- watchlist */
function renderWatchlist(){
  const grid = $('#wlGrid');
  const items = watchlist.map(w => ({
    id: w.id, title: w.title, year: w.year, poster: w.poster, downloads: 0, runtime: ''
  }));
  grid.innerHTML = items.map(m => cardHTML(m)).join('');
  hydrate(grid);
  $('#wlEmpty').hidden = items.length > 0;
  $('#wlCount').textContent = String(watchlist.length);
}

function toggleWatch(movie){
  const i = watchlist.findIndex(w => w.id === movie.id);
  if (i >= 0){ watchlist.splice(i, 1); toast('Removed from watchlist'); }
  else {
    watchlist.unshift({ id: movie.id, title: movie.title, year: movie.year, poster: movie.poster });
    watchlist = watchlist.slice(0, 200);
    toast('Saved to watchlist');
  }
  store.set(LS.watch, watchlist);
  $('#wlCount').textContent = String(watchlist.length);
  $$('[data-id="' + CSS.escape(movie.id) + '"] .card-fav').forEach(b => b.classList.toggle('on', i < 0));
  renderWatchlist();
}

/* ------------------------------------------------------------------ views */
function showView(name){
  ['home', 'browse', 'watchlist'].forEach(v => {
    const el = $('#view-' + v);
    if (el) el.hidden = (v !== name);
  });
  $$('.nav-btn[data-view]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-view') === name));
  if (name === 'watchlist') renderWatchlist();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------------------------------------ detail modal */
let detailMovie = null;

async function openDetail(id){
  const m = gridMovies.find(x => x.id === id) ||
            CURATED.filter(c => c.id === id).map(c => ({ id:c.id, title:c.title, year:c.year,
              poster:IMG(c.id), downloads:0, subjects:[], description:'' }))[0] ||
            { id: id, title: id, year: null, poster: IMG(id), downloads: 0, subjects: [], description: '' };
  detailMovie = m;

  $('#dTitle').textContent = m.title;
  $('#dPoster').src = m.poster;
  $('#dMeta').textContent = [m.year, m.downloads ? nfmt(m.downloads) + ' views' : '', 'Free to watch'].filter(Boolean).join('  \u00b7  ');
  $('#dDesc').textContent = m.description || 'Loading details\u2026';
  $('#dChips').innerHTML = '';
  $('#dSource').href = DETAILS(id);
  $('#dWatch').textContent = watchlist.some(w => w.id === id) ? '\u2713 In watchlist' : '+ Watchlist';
  $('#dSimilar').innerHTML = '';
  $('#detailModal').hidden = false;

  /* richer metadata, then optional poster/synopsis upgrade */
  try {
    const info = await resolveItem(id);
    detailMovie = Object.assign({}, m, info);
    detailMovie.poster = IMG(id);
    $('#dTitle').textContent = info.title || m.title;
    $('#dMeta').textContent = [info.year || m.year, info.length, info.sizeMB ? info.sizeMB + ' MB' : '',
                               'Free to watch'].filter(Boolean).join('  \u00b7  ');
    $('#dDesc').textContent = info.description || m.description ||
      'No synopsis on file for this title \u2014 but it plays right here.';
    $('#dChips').innerHTML = info.subjects.slice(0, 8).map(s => '<span>' + esc(s) + '</span>').join('');
    const tm = await tmdbLookup(info.title || m.title, info.year || m.year);
    if (tm){
      if (tm.poster) $('#dPoster').src = tm.poster;
      if (tm.overview) $('#dDesc').textContent = tm.overview;
      $('#dMeta').textContent = [info.year || m.year, tm.rating ? '\u2605 ' + tm.rating.toFixed(1) : '',
                                 info.length, 'Free to watch'].filter(Boolean).join('  \u00b7  ');
    }
    loadSimilar(detailMovie);
  } catch (e){
    $('#dDesc').textContent = 'This title could not be opened: ' + e.message;
  }
}

async function loadSimilar(m){
  const tags = (m.subjects || []).slice(0, 2).map(s => '"' + String(s).replace(/"/g, '') + '"');
  const q = BASE + (tags.length ? ' AND (' + tags.join(' OR ') + ')' :
    ' AND (title:("' + String(m.title).split(' ').slice(0, 3).join(' ') + '") OR subject:(drama))');
  try {
    const res = await apiSearch(q, { rows: 12, sort: 'downloads desc' });
    const list = res.movies.filter(x => x.id !== m.id).slice(0, 10);
    $('#dSimilar').innerHTML = list.length
      ? list.map(x => cardHTML(x)).join('')
      : '<p class="results-sub">No close relatives in the archive.</p>';
    hydrate($('#dSimilar'));
  } catch (e){
    $('#dSimilar').innerHTML = '<p class="results-sub">Could not load suggestions.</p>';
  }
}

function closeModals(){
  $('#detailModal').hidden = true;
  $('#settingsModal').hidden = true;
}
