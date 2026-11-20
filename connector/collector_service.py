"""Leonan negocIAtrader collector status and on-demand experimental runner.
Use only a separate IQ Option training login. No trading methods exist in this code.
HTTP public endpoints expose only readiness and timestamps, never credentials.
"""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from iq_readonly_bridge import main as run_collector

STATE = {
    "service": "negocIAtrader-collector",
    "mode": "read_only",
    "phase": "booting",
    "last_candle_utc": None,
    "last_sent_at_utc": None,
    "source": "community_iq_option_unverified",
}
LOCK = threading.Lock()

def update(event, **details):
    with LOCK:
        STATE["phase"] = event
        if event == "sent":
            STATE["last_candle_utc"] = details.get("candle_timestamp")
            STATE["last_sent_at_utc"] = int(time.time())
        if event == "error":
            STATE["last_error_type"] = str(details.get("error_type"))[:80]

def is_demo_confirmed():
    # Deliberate fail-closed gate; don't authenticate without explicit confirmation.
    return os.getenv("IQ_ACCOUNT_KIND") == "SEPARATE_DEMO_CONFIRMED"

def configured():
    keys = ("IQ_EMAIL", "IQ_PASSWORD", "IQ_ASSET", "FEED_API_URL", "FEED_INGEST_TOKEN")
    return all(os.getenv(key) for key in keys)

def runner():
    if not is_demo_confirmed():
        update("awaiting_separate_demo_account")
        return
    if not configured():
        update("missing_private_configuration")
        return
    try:
        update("starting")
        run_collector(notify=update)
    except Exception as err:
        update("stopped_due_to_error", error_type=type(err).__name__)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path not in ("/", "/health", "/ping"):
            self.send_error(404)
            return
        with LOCK:
            payload = dict(STATE)
        payload["demo_account_confirmed"] = is_demo_confirmed()
        payload["configured"] = configured()
        payload["checked_at_utc"] = int(time.time())
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *_args):
        # No URL logging, cookies or query strings.
        pass

def serve():
    port=int(os.getenv("PORT", "10000"))
    threading.Thread(target=runner, name="readonly-candle-collector", daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0",port),Handler).serve_forever()

if __name__ == "__main__":
    serve()
