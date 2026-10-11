# MovieMind AI

A movie site you can actually watch films on. Search it, ask for something in plain
English ("a scary black-and-white film from the 60s"), and press play — the film streams
straight into the page.

Every title comes from the Internet Archive's public-domain and openly-licensed
collection, so nothing here is pirated, nothing is behind a paywall, and **no API key
is needed to use it**.

## What's in it

| Piece | What it does |
| --- | --- |
| `index.html` | The whole interface — hero, search, ask bar, browse, watchlist, player |
| `js/01-core.js` | Catalogue + stream resolution, curated starter list, storage |
| `js/02-brain.js` | Turns a plain-English request into a search |
| `js/03-ui.js` | Rendering, cards, rows, views |
| `js/04-player.js` | The player, progress saving, "continue watching", subtitles |
| `server.py` | Optional local helper — serves the site and bridges subtitles |

## Run it

Double-click **`Start MovieMind.bat`**, or:

```
python server.py
```

then open <http://127.0.0.1:8777>.

You can also just open `index.html` directly. Everything works that way except
subtitles, because browsers block subtitle files from other domains unless a small
local bridge is running.

## Features

- Search 28,000+ feature films from the Internet Archive
- "Ask MovieMind" — describe a mood, get films
- Genuine streaming with seeking (HTTP range requests), not downloads
- Watchlist and continue-watching, saved in your browser
- Subtitles where the source has them
- Keyboard: `/` to search, `Esc` to close

## Optional keys

Settings has two optional fields. Nothing breaks without them:

- **TMDB** — richer posters and synopses (free key from themoviedb.org)
- **OpenAI-compatible** — nicer wording for the "Ask" suggestions

## Licence / source

Film metadata, thumbnails and video streams are served by
[archive.org](https://archive.org). Each film keeps its own licence — check the source
link in the player before reusing anything.
