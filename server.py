#!/usr/bin/env python3
"""
MovieMind AI - local helper server.

Does two jobs:
  1. serves the app at http://127.0.0.1:8777
  2. /api/captions?id=<archive-id>&f=<filename>
     fetches the archive.org subtitle file and converts .srt -> .vtt
     (the browser cannot fetch those directly because archive.org does not
      send a CORS header on media files - this bridges that gap)

Standard library only. Nothing to install.
"""

import http.server
import socketserver
import json
import os
import re
import sys
import webbrowser
import urllib.parse
import urllib.request
import threading

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, ".cache")
PORT = 8777
UA = {"User-Agent": "MovieMind/1.0 (local helper)"}


def srt_to_vtt(text):
    """Convert SubRip to WebVTT."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"^\ufeff", "", text)
    out = ["WEBVTT", ""]
    for block in re.split(r"\n{2,}", text):
        lines = [l for l in block.split("\n") if l.strip() != ""]
        if not lines:
            continue
        if re.match(r"^\d+$", lines[0].strip()):
            lines = lines[1:]
        if not lines:
            continue
        if "-->" in lines[0]:
            lines[0] = lines[0].replace(",", ".")
            out.append(lines[0])
            out.extend(lines[1:])
            out.append("")
    return "\n".join(out)


def fetch_subtitles(ident, filename):
    """Download a subtitle file from the Internet Archive, cached on disk."""
    os.makedirs(CACHE, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", ident + "__" + os.path.basename(filename))[:180]
    path = os.path.join(CACHE, safe + ".vtt")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()

    url = ("https://archive.org/download/" + urllib.parse.quote(ident) + "/" +
           "/".join(urllib.parse.quote(p) for p in filename.split("/")))
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw = resp.read()

    text = None
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        text = raw.decode("utf-8", "replace")

    vtt = text if filename.lower().endswith(".vtt") else srt_to_vtt(text)
    if not vtt.startswith("WEBVTT"):
        vtt = "WEBVTT\n\n" + vtt
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(vtt)
    return vtt


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stdout.write("  " + (fmt % args) + "\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def end_headers(self):
        if self.path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_HEAD(self):
        if self.path.startswith("/api/captions"):
            self._captions(head_only=True)
            return
        super().do_HEAD()

    def do_GET(self):
        if self.path.startswith("/api/health"):
            self._json(200, {"ok": True, "service": "MovieMind helper"})
            return
        if self.path.startswith("/api/captions"):
            self._captions()
            return
        super().do_GET()

    def _captions(self, head_only=False):
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        ident = (params.get("id") or [""])[0]
        fname = (params.get("f") or [""])[0]
        if not ident or not fname:
            self._json(400, {"error": "id and f are required"})
            return
        try:
            vtt = fetch_subtitles(ident, fname)
        except Exception as exc:  # noqa: BLE001
            self._json(502, {"error": str(exc)[:200]})
            return
        body = vtt.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/vtt; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self._cors()
        self.end_headers()
        if not head_only:
            self.wfile.write(body)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = PORT
    for candidate in range(PORT, PORT + 20):
        try:
            httpd = Server(("127.0.0.1", candidate), Handler)
            port = candidate
            break
        except OSError:
            continue
    else:
        print("Could not find a free port between 8777 and 8796.")
        return 1

    url = "http://127.0.0.1:%d/" % port
    print("")
    print("  MovieMind AI is running")
    print("  " + url)
    print("")
    print("  Subtitles enabled. Keep this window open while you watch.")
    print("  Press Ctrl+C to stop.")
    print("")
    if not os.environ.get("MM_NOLAUNCH"):
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
