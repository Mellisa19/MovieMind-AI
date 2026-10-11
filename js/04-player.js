/* ==========================================================================
   MovieMind AI — 04 player, settings, wiring
   ========================================================================== */

let playingId   = null;
let playingMeta = null;

/* --------------------------------------------------------------- the player */
function playerStatus(text, spinner){
  const box = $('#pStatus');
  box.classList.remove('hide');
  box.innerHTML = (spinner === false ? '' : '<div class="spinner"></div>') +
    '<p>' + esc(text) + '</p>';
}
function hidePlayerStatus(){ $('#pStatus').classList.add('hide'); }

function historyEntry(id){
  return history.find(h => h.id === id) || null;
}
function saveProgress(){
  if (!playingId || !playingMeta) return;
  const v = $('#video');
  if (!v.duration || !isFinite(v.duration)) return;
  const prog = v.currentTime / v.duration;
  const entry = {
    id: playingId,
    title: playingMeta.title || playingId,
    year: playingMeta.year || null,
    poster: playingMeta.poster || IMG(playingId),
    progress: prog,
    seconds: Math.round(v.currentTime),
    duration: Math.round(v.duration),
    at: Date.now()
  };
  history = [entry].concat(history.filter(h => h.id !== playingId)).slice(0, 60);
  store.set(LS.cont, history);
}
function fmtTime(s){
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
}

async function playTitle(movie){
  playingId = movie.id;
  playingMeta = movie;
  $('#pTitle').textContent = movie.title || movie.id;
  $('#pMeta').textContent = movie.year ? '\u00b7 ' + movie.year : '';
  $('#pInfo').textContent = '';
  $('#pCaptions').textContent = '';
  $('#pSource').href = DETAILS(movie.id);
  $('#pDownload').href = '#';
  $('#pResume').hidden = true;
  $('#pWatch').textContent = watchlist.some(w => w.id === movie.id) ? '\u2713 Watchlist' : '+ Watchlist';

  const v = $('#video');
  v.pause();
  v.removeAttribute('src');
  Array.from(v.querySelectorAll('track')).forEach(t => t.remove());
  v.load();

  $('#playerModal').hidden = false;
  playerStatus('Finding the best stream\u2026');

  let info;
  try {
    info = await resolveItem(movie.id);
  } catch (e){
    playerStatus(e.message + '  \u2014  Try the source link above, or pick another title.', false);
    return;
  }
  playingMeta = Object.assign({}, movie, info);

  $('#pTitle').textContent = info.title || movie.title;
  $('#pMeta').textContent = [info.year || movie.year, info.length].filter(Boolean).join('  \u00b7  ');
  $('#pDownload').href = info.videoUrl;
  $('#pDownload').setAttribute('download', info.fileName || '');
  $('#pDownload').target = '_blank';
  $('#pInfo').textContent = [info.fileName, info.sizeMB ? info.sizeMB + ' MB' : '',
                             info.creator ? 'by ' + info.creator : '',
                             info.license ? 'openly licensed' : 'public domain'].filter(Boolean).join('  \u00b7  ');

  /* subtitles: the local helper server converts .srt to .vtt for us */
  if (info.subUrl){
    if (HAS_SERVER){
      try {
        const url = '/api/captions?id=' + encodeURIComponent(movie.id) +
                    '&f=' + encodeURIComponent(info.subName);
        const probe = await fetch(url, { method:'HEAD' });
        if (probe.ok){
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = 'English';
          track.srclang = 'en';
          track.src = url;
          track.default = true;
          v.appendChild(track);
          $('#pCaptions').textContent = 'Subtitles on (toggle in the player)';
        } else {
          $('#pCaptions').textContent = 'No subtitles for this title';
        }
      } catch (e){ /* captions are a bonus, never a blocker */ }
    } else {
      $('#pCaptions').textContent = 'Subtitles for this title need the desktop version';
    }
  }

  playerStatus('Buffering\u2026');
  v.src = info.videoUrl;
  v.load();

  /* resume */
  const past = historyEntry(movie.id);
  if (past && past.seconds > 30 && past.duration && past.seconds < past.duration - 20){
    $('#pResume').hidden = false;
    $('#pResume').textContent = 'Resume from ' + fmtTime(past.seconds);
    $('#pResume').onclick = function(){
      v.currentTime = past.seconds;
      v.play();
      $('#pResume').hidden = true;
    };
  }

  v.oncanplay = function(){ hidePlayerStatus(); v.play().catch(() => {}); };
  v.onplaying = hidePlayerStatus;
  v.onwaiting = function(){ playerStatus('Buffering\u2026'); };
  v.onerror   = function(){
    playerStatus('This stream would not open in the browser. Try the Source link above \u2014 ' +
                 'or pick a different title.', false);
  };
}

function stopPlayback(){
  const v = $('#video');
  try { saveProgress(); } catch (e){}
  v.pause();
  v.removeAttribute('src');
  Array.from(v.querySelectorAll('track')).forEach(t => t.remove());
  v.load();
  playingId = null;
  $('#playerModal').hidden = true;
}

/* ----------------------------------------------------------------- settings */
function openSettings(){
  $('#sTmdb').value = settings.tmdb || '';
  $('#sLlm').value = settings.llm || '';
  $('#sEndpoint').value = settings.endpoint || 'https://api.deepseek.com/chat/completions';
  $('#sStatus').textContent = '';
  $('#settingsModal').hidden = false;
}
function saveSettings(){
  settings = {
    tmdb: $('#sTmdb').value.trim(),
    llm: $('#sLlm').value.trim(),
    endpoint: $('#sEndpoint').value.trim()
  };
  store.set(LS.set, settings);
  $('#sStatus').textContent = 'Saved. ' + (settings.tmdb ? 'TMDB enrichment is on. ' : '') +
    (settings.llm && settings.endpoint ? 'Language-model refinement is on.' : 'Running on the offline brain.');
  toast('Settings saved');
}

/* --------------------------------------------------------------------- wire */
function wire(){
  /* nav */
  $$('.nav-btn[data-view]').forEach(function(b){
    b.addEventListener('click', () => showView(b.getAttribute('data-view')));
  });
  $('#brandHome').addEventListener('click', function(e){ e.preventDefault(); showView('home'); });
  $('#settingsBtn').addEventListener('click', openSettings);

  /* search */
  $('#searchForm').addEventListener('submit', function(e){
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (q) runAsk(q);
  });
  $('#searchInput').addEventListener('input', function(){
    $('#searchClear').style.display = this.value ? 'block' : 'none';
  });
  $('#searchClear').addEventListener('click', function(){
    $('#searchInput').value = '';
    this.style.display = 'none';
    showView('home');
  });

  /* ask bar */
  $('#askForm').addEventListener('submit', function(e){
    e.preventDefault();
    const q = $('#askInput').value.trim();
    if (q) runAsk(q);
  });
  $('#askChips').addEventListener('click', function(e){
    const b = e.target.closest('.chip');
    if (!b) return;
    $('#askInput').value = b.getAttribute('data-ask');
    runAsk(b.getAttribute('data-ask'));
  });

  /* hero */
  $('#heroPlay').addEventListener('click', () => playTitle(heroPick));
  $('#heroInfo').addEventListener('click', () => openDetail(heroPick.id));
  $('#heroShuffle').addEventListener('click', function(){
    const pick = CURATED[Math.floor(Math.random() * CURATED.length)];
    setHero({ id:pick.id, title:pick.title, year:pick.year, tag:pick.tag, poster:IMG(pick.id) });
    toast('Now featuring: ' + pick.title);
  });

  /* filters */
  ['#fGenre', '#fDecade', '#fSort', '#fType'].forEach(function(sel){
    $(sel).addEventListener('change', () => runBrowse(true));
  });
  $('#fReset').addEventListener('click', function(){
    $('#fGenre').value = ''; $('#fDecade').value = '';
    $('#fSort').value = 'downloads'; $('#fType').value = '';
    runBrowse(true);
  });
  $('#loadMore').addEventListener('click', function(){
    if (currentKind === 'search') return;
    currentPage += 1;
    runBrowse(false);
  });

  /* card clicks — one delegated handler covers every grid and row */
  document.addEventListener('click', function(e){
    const fav = e.target.closest('.card-fav');
    if (fav){
      e.stopPropagation();
      const id = fav.getAttribute('data-fav');
      const m = gridMovies.find(x => x.id === id) ||
                CURATED.filter(c => c.id === id).map(c => ({ id:c.id, title:c.title, year:c.year, poster:IMG(c.id) }))[0] ||
                { id: id, title: id, year: null, poster: IMG(id) };
      toggleWatch(m);
      return;
    }
    const card = e.target.closest('.card[data-id]');
    if (card && !e.target.closest('.similar-row, #wlGrid, .row-scroll')) openDetail(card.getAttribute('data-id'));
    else if (card) openDetail(card.getAttribute('data-id'));
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Enter'){
      const card = e.target.closest && e.target.closest('.card[data-id]');
      if (card){ openDetail(card.getAttribute('data-id')); }
    }
  });

  /* modals */
  $$('[data-close]').forEach(el => el.addEventListener('click', function(){
    const modal = el.closest('.modal');
    if (modal && modal.id === 'playerModal') stopPlayback(); else closeModals();
  }));

  /* detail actions */
  $('#dPlay').addEventListener('click', function(){
    const m = detailMovie;
    closeModals();
    playTitle(m);
  });
  $('#dWatch').addEventListener('click', function(){
    if (!detailMovie) return;
    toggleWatch(detailMovie);
    this.textContent = watchlist.some(w => w.id === detailMovie.id) ? '\u2713 In watchlist' : '+ Watchlist';
  });

  /* player actions */
  $('#pWatch').addEventListener('click', function(){
    if (!playingMeta) return;
    toggleWatch(playingMeta);
    this.textContent = watchlist.some(w => w.id === playingMeta.id) ? '\u2713 Watchlist' : '+ Watchlist';
  });
  const v = $('#video');
  v.addEventListener('timeupdate', function(){
    if (Math.round(v.currentTime) % 10 === 0) saveProgress();
  });
  v.addEventListener('pause', saveProgress);
  v.addEventListener('ended', function(){
    saveProgress();
    toast('Finished \u2014 nice one.');
  });
  window.addEventListener('beforeunload', function(){ try { saveProgress(); } catch (e){} });

  /* settings actions */
  $('#sSave').addEventListener('click', saveSettings);
  $('#sClear').addEventListener('click', function(){
    watchlist = []; history = [];
    store.set(LS.watch, watchlist); store.set(LS.cont, history);
    renderWatchlist(); renderHomeRows();
    $('#sStatus').textContent = 'Watchlist and viewing history cleared.';
    toast('Cleared');
  });

  /* global keys */
  document.addEventListener('keydown', function(e){
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''));
    if (e.key === '/' && !typing){ e.preventDefault(); $('#searchInput').focus(); }
    if (e.key === 'Escape'){
      if (!$('#playerModal').hidden) stopPlayback();
      else closeModals();
    }
    if (e.key === ' ' && !typing && !$('#playerModal').hidden){
      const vid = $('#video');
      e.preventDefault();
      if (vid.paused) vid.play(); else vid.pause();
    }
    if ((e.key === 'f' || e.key === 'F') && !typing && !$('#playerModal').hidden){
      const stage = document.querySelector('.player-stage');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage && stage.requestFullscreen) stage.requestFullscreen();
    }
  });
}

/* --------------------------------------------------------------------- init */
async function init(){
  $('#wlCount').textContent = String(watchlist.length);
  setHero({ id: CURATED[0].id, title: CURATED[0].title, year: CURATED[0].year,
            tag: CURATED[0].tag, poster: IMG(CURATED[0].id) });
  renderHomeRows();
  wire();

  if (location.protocol === 'file:'){
    toast('Tip: for subtitles, start MovieMind with "Start MovieMind.bat" rather than opening the file directly.', 6000);
  }

  /* keep the hero lively: swap in a real archive pick every 12s */
  try {
    const res = await apiSearch(ROWS[0].q, { rows: 6, sort: 'downloads desc' });
    const pool = res.movies.slice(0, 5);
    if (pool.length){
      let i = 0;
      setInterval(function(){
        if (document.hidden) return;
        setHero({ id: pool[i].id, title: pool[i].title, year: pool[i].year,
                  tag: pool[i].subjects[0] || 'Film Noir', poster: pool[i].poster });
        i = (i + 1) % pool.length;
      }, 12000);
    }
  } catch (e){ /* offline is fine; the curated hero stays */ }
}

document.addEventListener('DOMContentLoaded', init);
