#!/usr/bin/env python3
"""One-command dev launcher for Comsierge (Windows-friendly).

Starts:
- Backend (server) on 0.0.0.0:5000
- Frontend (Vite) on 0.0.0.0:8080
- Optional ngrok tunnel to the frontend

Then verifies:
- Backend health (/api/health)
- MongoDB connection reported by backend
- Optional Twilio credential check (via backend route) if creds are present in env

This script avoids printing secrets.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "server"


@dataclass(frozen=True)
class CmdResult:
    ok: bool
    stdout: str
    stderr: str


def run_capture(cmd: list[str], cwd: Path | None = None) -> CmdResult:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,
        )
        return CmdResult(proc.returncode == 0, proc.stdout, proc.stderr)
    except FileNotFoundError as e:
        return CmdResult(False, "", str(e))


def http_get_json(url: str, timeout_s: float = 3.0) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "dev_up/1.0"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return json.loads(body)


def http_get_status(url: str, timeout_s: float = 3.0) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": "dev_up/1.0"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        return int(resp.status)


def http_post_json(url: str, payload: dict, timeout_s: float = 6.0) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "dev_up/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return json.loads(body)


def find_lan_ip() -> str:
    # Best-effort: open a UDP socket so OS selects the outbound interface.
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
        finally:
            s.close()
    except OSError:
        pass

    # Fallback: hostname resolution
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass

    return "127.0.0.1"


def load_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    content = path.read_text(encoding="utf-8", errors="replace")
    env: dict[str, str] = {}
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        env[k] = v
    return env


def require_tools() -> None:
    missing = []
    for tool in ["node", "npm"]:
        if shutil.which(tool) is None:
            missing.append(tool)
    if missing:
        raise SystemExit(f"Missing required tools in PATH: {', '.join(missing)}")


def ensure_installed() -> None:
    # Root deps
    if not (ROOT / "node_modules").exists():
        print("Installing frontend dependencies...")
        subprocess.check_call(["npm", "install"], cwd=str(ROOT), shell=False)

    # Server deps
    if not (SERVER_DIR / "node_modules").exists():
        print("Installing backend dependencies...")
        subprocess.check_call(["npm", "install"], cwd=str(SERVER_DIR), shell=False)


def start_new_console(cmd: str, cwd: Path) -> subprocess.Popen:
    # Windows-only: open a brand new console window.
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_CONSOLE

    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        creationflags=creationflags,
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def is_listening(host: str, port: int, timeout_s: float = 0.3) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout_s):
            return True
    except OSError:
        return False


def _pids_listening_on_port(port: int) -> set[int]:
    """Best-effort Windows port->PID mapping via netstat.

    Returns a set of PIDs that have a LISTENING socket on the given port.
    """
    if os.name != "nt":
        return set()

    # Example netstat -ano line:
    #   TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       9664
    result = run_capture(["netstat", "-ano", "-p", "TCP"])
    if not result.ok:
        return set()

    pids: set[int] = set()
    port_pat = re.compile(rf"\:{port}\s")
    for line in (result.stdout or "").splitlines():
        if "LISTENING" not in line:
            continue
        if not port_pat.search(line):
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        pid_str = parts[-1]
        try:
            pids.add(int(pid_str))
        except ValueError:
            continue
    return pids


def kill_port_listeners(ports: list[int]) -> None:
    """Kill processes listening on the given TCP ports (Windows only)."""
    if os.name != "nt":
        return
    pids: set[int] = set()
    for p in ports:
        pids |= _pids_listening_on_port(p)

    if not pids:
        return

    for pid in sorted(pids):
        # /T kills child processes too.
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
        )


def wait_for_health(base_url: str, timeout_s: float) -> dict:
    deadline = time.time() + timeout_s
    last_err = None
    while time.time() < deadline:
        try:
            return http_get_json(f"{base_url}/api/health", timeout_s=3.0)
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.5)
    raise RuntimeError(f"Backend did not become healthy in time. Last error: {last_err}")


def try_get_ngrok_public_url(timeout_s: float = 20.0) -> str | None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            data = http_get_json("http://127.0.0.1:4040/api/tunnels", timeout_s=2.0)
            tunnels = data.get("tunnels") or []
            for t in tunnels:
                url = t.get("public_url")
                if isinstance(url, str) and url.startswith("http"):
                    return url
        except Exception:
            pass
        time.sleep(0.5)
    return None


def mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 6:
        return "***"
    return value[:3] + "…" + value[-3:]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--api-port", type=int, default=5000)
    parser.add_argument("--no-ngrok", action="store_true")
    parser.add_argument("--ngrok-port", type=int, default=8080, help="Port to expose via ngrok")
    parser.add_argument("--health-timeout", type=float, default=30.0)
    parser.add_argument(
        "--restart",
        action="store_true",
        help="Stop existing listeners on ports before starting (Windows).",
    )
    args = parser.parse_args()

    require_tools()

    # Validate server .env (don’t print secrets)
    server_env = load_dotenv(SERVER_DIR / ".env")
    if not server_env.get("MONGODB_URI"):
        print("ERROR: server/.env is missing MONGODB_URI")
        return 2

    ensure_installed()

    lan_ip = find_lan_ip()

    if args.restart:
        # Stop whatever is currently bound so this script is the single entrypoint.
        # Include ngrok's local API port (4040).
        print("Restart enabled: stopping existing listeners...")
        kill_port_listeners([args.api_port, args.port, 4040])
        time.sleep(1.0)

    # Start backend (only if not already listening)
    if is_listening("127.0.0.1", args.api_port):
        print(f"Backend already listening on :{args.api_port} (skipping start)")
    else:
        print("Starting backend (new PowerShell window)...")
        start_new_console("npm run dev", cwd=SERVER_DIR)

    # Start frontend (only if not already listening)
    if is_listening("127.0.0.1", args.port):
        print(f"Frontend already listening on :{args.port} (skipping start)")
    else:
        print("Starting frontend (new PowerShell window)...")
        start_new_console(f"npm run dev -- --host 0.0.0.0 --port {args.port}", cwd=ROOT)

    # Optional ngrok
    ngrok_public = None
    if not args.no_ngrok:
        if shutil.which("ngrok") is None:
            print("ngrok not found in PATH; skipping ngrok. (Install ngrok and run again)")
        else:
            print("Starting ngrok (new window)...")
            start_new_console(f"ngrok http {args.ngrok_port}", cwd=ROOT)
            ngrok_public = try_get_ngrok_public_url()

    # Verify backend + DB via health endpoint (force IPv4 loopback)
    api_base = f"http://127.0.0.1:{args.api_port}"
    print("Waiting for backend health...")
    health = wait_for_health(api_base, timeout_s=args.health_timeout)

    mongodb = health.get("mongodb")
    if mongodb != "connected":
        print(f"WARNING: backend is up but MongoDB reports: {mongodb}")
    else:
        print("MongoDB: connected")

    # Optional Twilio verification: we can only check if user provides creds.
    # We’ll look for env vars in the *current* environment first.
    tw_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    tw_token = os.environ.get("TWILIO_AUTH_TOKEN")
    tw_phone = os.environ.get("TWILIO_PHONE_NUMBER")

    if tw_sid and tw_token:
        try:
            print(f"Checking Twilio credentials (SID {mask(tw_sid)})...")
            resp = http_post_json(
                f"{api_base}/api/twilio/verify-credentials",
                {"accountSid": tw_sid, "authToken": tw_token, "phoneNumber": tw_phone},
                timeout_s=10.0,
            )
            if resp.get("success") is True:
                print("Twilio: verified")
            else:
                print(f"Twilio: not verified ({resp.get('message')})")
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                body = ""
            print(f"Twilio verify failed (HTTP {e.code}). {body[:200]}")
        except Exception as e:
            print(f"Twilio verify failed: {e}")
    else:
        print("Twilio: skipped (set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars to auto-verify)")

    # If we have ngrok + Twilio phone number, configure Twilio webhooks automatically.
    if ngrok_public and tw_sid and tw_token and tw_phone:
        try:
            print(f"Configuring Twilio webhooks for {tw_phone} -> {ngrok_public} ...")
            resp = http_post_json(
                f"{api_base}/api/twilio/configure-webhooks",
                {
                    "accountSid": tw_sid,
                    "authToken": tw_token,
                    "phoneNumber": tw_phone,
                    "baseUrl": ngrok_public,
                },
                timeout_s=15.0,
            )
            if resp.get("success") is True:
                print("Twilio webhooks: configured")
            else:
                print(f"Twilio webhooks: failed ({resp.get('message')})")
        except Exception as e:
            print(f"Twilio webhooks: failed ({e})")

    # Quick frontend check
    try:
        code = http_get_status(f"http://127.0.0.1:{args.port}/", timeout_s=3.0)
        print(f"Frontend: HTTP {code}")
    except Exception as e:
        print(f"WARNING: Frontend check failed: {e}")

    print("\nLinks:")
    print(f"- Frontend (LAN):  http://{lan_ip}:{args.port}/")
    print(f"- Backend health:  http://{lan_ip}:{args.api_port}/api/health")
    if ngrok_public:
        print(f"- Frontend (ngrok): {ngrok_public}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
