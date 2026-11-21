#!/usr/bin/env python3
"""
edex_fix_shell.py - fix the eDEX-UI black screen caused by the shell-env probe hanging.

Symptom (from /root/startx.log):
    success   Settings loaded!
    ... then nothing; the window is never created (black screen).
    Later: "Command failed: /usr/bin/bash -ilc echo -n _SHELL_ENV_DELIMITER_ ..."

What this script does (run as root, from the console):
  1. Creates /usr/local/bin/edex-shell, a wrapper around bash. When eDEX-UI probes the
     environment with "bash -ilc ...", the wrapper runs it non-interactively without
     profile/bashrc, so it cannot hang. Normal terminals get a regular bash.
  2. Sets "shell" to that wrapper in ~/.config/eDEX-UI/settings.json (backup is kept).
  3. Rewrites ~/.xinitrc to start openbox (window manager) first, then eDEX-UI,
     with GPU-safe flags and a run log at ~/edex-run.log.
  4. Warns about manual 'startx' lines in your shell startup files.

Usage:
    python3 edex_fix_shell.py          # apply the fix
    python3 edex_fix_shell.py --revert # restore original settings.json and .xinitrc backups
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys
from pathlib import Path

HOME = Path(os.environ.get("EDEX_HOME", "/root"))
APPIMAGE = HOME / "eDEX-UI-Linux-x86_64.AppImage"
SETTINGS = HOME / ".config/eDEX-UI/settings.json"
XINITRC = HOME / ".xinitrc"
WRAPPER = Path("/usr/local/bin/edex-shell")
RUN_LOG = HOME / "edex-run.log"

WRAPPER_SCRIPT = """#!/bin/bash
# eDEX-UI shell wrapper (managed by edex_fix_shell.py)
# eDEX-UI's shell-env runs:  <shell> -ilc '<command>'  and waits for it.
# An interactive login bash can hang there inside a bare X session, so run that
# probe as a plain non-interactive command. Real terminals get a normal bash.
case "${1:-}" in
  -*c*)
    shift
    exec /usr/bin/bash --noprofile --norc -c "$@"
    ;;
esac
exec /usr/bin/bash "$@"
"""

XINITRC_TEXT = f"""# managed by install_edex.py
openbox &
sleep 1
exec {APPIMAGE} --appimage-extract-and-run --no-sandbox --disable-gpu --in-process-gpu >> {RUN_LOG} 2>&1
"""


def ok(m: str) -> None:
    print(f"[ OK ] {m}")


def warn(m: str) -> None:
    print(f"[WARN] {m}")


def fail(m: str) -> None:
    print(f"[FAIL] {m}")


def backup(path: Path) -> Path | None:
    if not path.exists():
        return None
    dest = path.with_name(f"{path.name}.edexfix.{dt.datetime.now():%Y%m%d-%H%M%S}")
    shutil.copy2(path, dest)
    ok(f"Backup: {dest}")
    return dest


def newest_backup(path: Path) -> Path | None:
    cands = sorted(path.parent.glob(f"{path.name}.edexfix.*"))
    return cands[-1] if cands else None


def apply() -> int:
    if not APPIMAGE.exists():
        fail(f"{APPIMAGE} not found. Run install_edex.py first.")
        return 1

    # 1) wrapper
    WRAPPER.write_text(WRAPPER_SCRIPT)
    WRAPPER.chmod(0o755)
    ok(f"Wrapper installed: {WRAPPER}")

    # 2) settings.json
    if SETTINGS.exists():
        try:
            data = json.loads(SETTINGS.read_text())
        except json.JSONDecodeError as e:
            fail(f"{SETTINGS} is not valid JSON ({e}). Delete it and let eDEX-UI recreate it.")
            return 1
        backup(SETTINGS)
        data["shell"] = str(WRAPPER)
        SETTINGS.write_text(json.dumps(data, indent=4) + "\n")
        ok(f'settings.json: "shell" = {WRAPPER}')
    else:
        warn(f"{SETTINGS} does not exist yet (created on first eDEX-UI run).")
        warn("Run 'startx' once, close it (or reboot to console), then run this script again.")

    # 3) .xinitrc
    backup(XINITRC)
    XINITRC.write_text(XINITRC_TEXT)
    XINITRC.chmod(0o755)
    ok(f"{XINITRC} rewritten (openbox + eDEX-UI, log: {RUN_LOG})")

    # 4) manual startx lines
    for name in (".bash_profile", ".profile", ".bashrc", ".bash_login"):
        f = HOME / name
        if f.exists():
            for n, line in enumerate(f.read_text().splitlines(), 1):
                if re.match(r"^\s*(exec\s+)?startx\b", line):
                    warn(f"{f}:{n} contains '{line.strip()}'. If it is not inside the managed "
                         "'edex-ui autostart' block, remove it, otherwise it can start X recursively.")

    print("\nNow test from the console (tty1/tty2):\n  startx")
    print("Wait up to ~30s before judging it. Close with Ctrl+Shift+Q.")
    print(f"If still black: Ctrl+Alt+F2, then   tail -40 {RUN_LOG}")
    return 0


def revert() -> int:
    for target in (SETTINGS, XINITRC):
        b = newest_backup(target)
        if b:
            shutil.copy2(b, target)
            ok(f"Restored {target} from {b.name}")
        else:
            warn(f"No backup found for {target}")
    if WRAPPER.exists():
        WRAPPER.unlink()
        ok(f"Removed {WRAPPER}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Fix eDEX-UI black screen (shell-env hang).")
    ap.add_argument("--revert", action="store_true", help="restore backups and remove the wrapper")
    args = ap.parse_args()
    if os.geteuid() != 0:
        fail("Run as root.")
        return 1
    return revert() if args.revert else apply()


if __name__ == "__main__":
    sys.exit(main())
