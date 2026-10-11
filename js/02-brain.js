/* ==========================================================================
   MovieMind AI — 02 brain
   Turns plain English into an archive query. Runs fully offline, no key.
   ========================================================================== */

function understand(text){
  const raw = String(text || '').trim();
  const low = ' ' + raw.toLowerCase().replace(/[^\w\s&:'-]/g, ' ').replace(/\s+/g,' ') + ' ';
  const out = { raw: raw, genres: [], keywords: [], yearMin: null, yearMax: null,
                collection: null, notes: [], decade: null };

  /* 1. genre + mood words */
  Object.keys(GENRES).forEach(function(genre){
    const hit = GENRES[genre].some(w => low.indexOf(' ' + w + ' ') >= 0 || low.indexOf(' ' + w + 's ') >= 0);
    if (hit) out.genres.push(genre);
  });

  /* 2. decade: "60s", "1960s", "sixties" */
  const dnum  = /\b(1[89]|20)?(\d0)\s*'?s\b/.exec(low);
  const dword = Object.keys(DECADE_WORDS).find(w => low.indexOf(' ' + w + ' ') >= 0);
  let decade = null;
  if (dnum){
    const tens = parseInt(dnum[2], 10);
    const full = dnum[1] ? parseInt(dnum[1] + dnum[2], 10) : (tens > 20 ? 1800 + tens : 1900 + tens);
    decade = Math.floor(full / 10) * 10;
  } else if (dword){
    decade = DECADE_WORDS[dword];
  }
  if (decade){
    out.yearMin = decade; out.yearMax = decade + 9; out.decade = decade;
    out.notes.push(decade + 's');
  }

  /* 3. explicit years and open ranges */
  const exact  = /\b(?:from|in|of|made in|released in)\s+((?:18|19|20)\d{2})\b/.exec(low);
  const before = /\b(?:before|pre|up to|earlier than)\s+((?:18|19|20)\d{2})\b/.exec(low);
  const after  = /\b(?:after|since|later than|post)\s+((?:18|19|20)\d{2})\b/.exec(low);
  if (exact && !decade){ const y = +exact[1]; out.yearMin = y; out.yearMax = y; out.notes.push(String(y)); }
  if (before){ out.yearMax = +before[1]; out.notes.push('before ' + before[1]); }
  if (after){  out.yearMin = +after[1]; out.notes.push('after ' + after[1]); }
  if (!decade && !exact && /\b(old|oldschool|classic|classics|vintage|golden age|retro)\b/.test(low)){
    out.yearMax = out.yearMax || 1975; out.notes.push('classic era');
  }

  /* 4. shape filters */
  if (out.genres.indexOf('Silent') >= 0 || /\bsilent\b/.test(low)){
    out.collection = 'silent_films'; out.notes.push('silent');
  }
  if (/\b(short|shorts|under an hour|quick|brief)\b/.test(low)){
    out.collection = out.collection || 'short_films'; out.notes.push('short films');
  }
  if (/\bnoir\b/.test(low)) out.collection = 'Film_Noir';
  if (/\b(black and white|black-and-white|b&w|monochrome)\b/.test(low)) out.notes.push('black & white');
  if (/\b(most popular|popular|famous|best|top|acclaimed|well known)\b/.test(low)) out.notes.push('most watched');

  /* 5. whatever is left becomes free-text keywords (titles, people) */
  const words = low.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const used = new Set();
  Object.keys(GENRES).forEach(g => GENRES[g].forEach(w => w.split(' ').forEach(x => used.add(x))));
  Object.keys(DECADE_WORDS).forEach(w => used.add(w));
  ['silent','short','shorts','film','films','movie','movies','old','classic','classics','vintage',
   'black','white','colour','color','cartoon','cartoons','animated','animation','and','from',
   'before','after','since','pre','post','night','today','with','that','under','hour','hours',
   'something','anything','stuff'].forEach(w => used.add(w));
  words.forEach(function(w){
    if (w.length < 3 || STOP.has(w) || used.has(w)) return;
    if (out.keywords.indexOf(w) < 0) out.keywords.push(w);
  });
  out.keywords = out.keywords.slice(0, 6);
  if (out.keywords.length) out.notes.push('\u201c' + out.keywords.join(' ') + '\u201d');
  return out;
}

function buildQuery(it){
  const parts = [BASE];
  if (it.collection) parts.push('collection:(' + it.collection + ')');
  const g = it.genres.map(x => GENRE_QUERY[x]).filter(Boolean);
  if (g.length) parts.push('(' + g.join(' OR ') + ')');
  if (it.keywords.length) parts.push('(' + it.keywords.map(k => k + ' OR ' + k + '*').join(' OR ') + ')');
  if (it.yearMin || it.yearMax)
    parts.push('year:[' + (it.yearMin || 1800) + ' TO ' + (it.yearMax || 2100) + ']');
  return parts.join(' AND ');
}

/* Re-rank so the strongest matches float up. Local and explainable. */
function rerank(movies, it){
  if (!movies.length) return movies;
  const maxDl = Math.max.apply(null, movies.map(m => m.downloads).concat([1]));
  return movies.map(function(m){
    let s = Math.log10(m.downloads + 10) / Math.log10(maxDl + 10) * 1.2;
    const t = m.title.toLowerCase();
    it.keywords.forEach(k => { if (t.indexOf(k) >= 0) s += 1.4; });
    it.genres.forEach(function(g){
      const gq = g.toLowerCase();
      if (t.indexOf(gq) >= 0) s += 0.9;
      if (m.subjects.some(x => x.toLowerCase().indexOf(gq) >= 0)) s += 0.5;
    });
    if (it.decade && m.year && m.year >= it.decade && m.year <= it.decade + 9) s += 0.8;
    if (/trailer|interview|behind the scenes|making of|commentary|review/i.test(m.title)) s -= 4;
    if (/^(ab|untitled|\d+|test)$/i.test(m.title) || m.title.length < 3) s -= 3;
    return { m: m, s: s };
  }).sort((a, b) => b.s - a.s).map(x => x.m);
}

/* Optional: let a language model refine the request. Never required. */
async function llmUnderstand(text){
  if (!settings.llm || !settings.endpoint) return null;
  try {
    const r = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + settings.llm },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        messages: [
          { role:'system', content:
            'You convert film requests into JSON. Reply ONLY with JSON shaped like ' +
            '{"genres":[],"keywords":[],"yearMin":null,"yearMax":null,"collection":null}. ' +
            'Allowed genres: ' + Object.keys(GENRE_QUERY).join(', ') + '. ' +
            'collection may be null, "silent_films", "short_films" or "Film_Noir".' },
          { role:'user', content: text }
        ]
      })
    });
    if (!r.ok) return null;
    const j = await r.json();
    const txt = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch (e){ return null; }
}

function mergeLLM(it, extra){
  if (!extra) return it;
  const merged = Object.assign({}, it, { notes: it.notes.slice() });
  const gs = (extra.genres || []).filter(g => GENRE_QUERY[g]);
  if (gs.length){
    merged.genres = Array.from(new Set(it.genres.concat(gs)));
    merged.notes.push('AI refined');
  }
  if (Array.isArray(extra.keywords) && extra.keywords.length)
    merged.keywords = Array.from(new Set(extra.keywords.map(String).concat(it.keywords))).slice(0, 6);
  if (extra.yearMin) merged.yearMin = +extra.yearMin;
  if (extra.yearMax) merged.yearMax = +extra.yearMax;
  if (extra.collection) merged.collection = String(extra.collection);
  return merged;
}

/* Optional TMDB enrichment — applied only on a confident title + year match. */
const TMDB_IMG = p => 'https://image.tmdb.org/t/p/w500' + p;
async function tmdbLookup(title, year){
  if (!settings.tmdb) return null;
  try {
    const p = new URLSearchParams({ api_key: settings.tmdb, query: title });
    if (year) p.append('year', String(year));
    const r = await fetch('https://api.themoviedb.org/3/search/movie?' + p);
    if (!r.ok) return null;
    const j = await r.json();
    const hit = (j.results || [])[0];
    if (!hit) return null;
    const ry = (hit.release_date || '').slice(0, 4);
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm(hit.title) !== norm(title)) return null;
    if (year && ry && Math.abs(+ry - +year) > 1) return null;
    return { poster: hit.poster_path ? TMDB_IMG(hit.poster_path) : null,
             overview: hit.overview || '',
             rating: hit.vote_average || null };
  } catch (e){ return null; }
}
