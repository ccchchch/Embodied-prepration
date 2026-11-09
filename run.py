#!/usr/bin/env python3
"""Serve only this standalone app on loopback; no third-party dependencies."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="具身研习室 · 本地启动")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    handler = functools.partial(AppHandler, directory=str(Path(__file__).resolve().parent))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as exc:
        parser.exit(1, f"启动失败：{exc}。请检查端口是否已占用。\n")
    print(f"具身研习室已启动：http://127.0.0.1:{args.port}\n按 Ctrl+C 停止。", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
