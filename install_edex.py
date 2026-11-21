#!/usr/bin/env python3
"""
install_edex.py - eDEX-UI installer for Debian 13 (trixie) amd64, CLI-only systems.

Turns a text-only Debian box into a machine that boots straight into eDEX-UI:

    boot -> auto-login on tty1 -> startx -> eDEX-UI (fullscreen)

Works with an EXISTING user (root by default). It never creates or modifies
user accounts. Every change is idempotent, marked, and reversible (--uninstall).

Usage (run as root):
    python3 install_edex.py                 # full install + boot autostart
    python3 install_edex.py --no-autostart  # install only, start manually with startx
    python3 install_edex.py --dry-run       # show what would happen, change nothing
    python3 install_edex.py --user alice    # use an existing user instead of root
    python3 install_edex.py --uninstall     # remove autostart + autologin
    python3 install_edex.py --uninstall --purge   # also delete AppImage and config
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import os
import platform
import pwd
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
VERSION = "v2.2.8"
APPIMAGE = "eDEX-UI-Linux-x86_64.AppImage"
URL = f"https://github.com/GitSquared/edex-ui/releases/download/{VERSION}/{APPIMAGE}"
MIN_SIZE_BYTES = 10 * 1024 * 1024  # sanity check: AppImage is far larger than this

PACKAGES = [
    "xorg", "xinit", "openbox", "wget", "ca-certificates", "fonts-dejavu-core",
    "libfuse2t64", "libgtk-3-0t64", "libnss3", "libgbm1",
    "libasound2t64", "libxss1", "libxtst6",
]

MARK_BEGIN = "# >>> edex-ui autostart (managed by install_edex.py) >>>"
MARK_END = "# <<< edex-ui autostart <<<"
XINITRC_TAG = "# managed by install_edex.py"
AUTOLOGIN_DIR = Path("/etc/systemd/system/getty@tty1.service.d")
AUTOLOGIN_CONF = AUTOLOGIN_DIR / "edex-autologin.conf"

log = logging.getLogger("edex")


class InstallError(RuntimeError):
    """Fatal, user-presentable error."""


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
class Colors:
    on = sys.stdout.isatty()
    @staticmethod
    def c(code: str, s: str) -> str:
        return f"\033[{code}m{s}\033[0m" if Colors.on else s


class Fmt(logging.Formatter):
    LEVELS = {
        logging.INFO: ("32", "[ OK ]"),
        logging.WARNING: ("33", "[WARN]"),
        logging.ERROR: ("31", "[FAIL]"),
        logging.DEBUG: ("36", "[ .. ]"),
    }

    def format(self, record: logging.LogRecord) -> str:
        code, tag = self.LEVELS.get(record.levelno, ("0", "[    ]"))
        return f"{Colors.c(code, tag)} {record.getMessage()}"


class Installer:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.dry = args.dry_run
        try:
            self.pw = pwd.getpwnam(args.user)
        except KeyError:
            raise InstallError(f"User '{args.user}' does not exist (this script never creates users).")
        self.home = Path(self.pw.pw_dir)
        self.app_path = self.home / APPIMAGE
        self.xinitrc = self.home / ".xinitrc"

    # ---- low-level -------------------------------------------------------- #
    def step(self, title: str) -> None:
        print("\n" + Colors.c("1;36", f"== {title}"))

    def run(self, cmd: list[str], env: dict | None = None) -> None:
        log.debug("$ %s", " ".join(cmd))
        if self.dry:
            return
        try:
            subprocess.run(cmd, check=True, env=env)
        except FileNotFoundError:
            raise InstallError(f"Command not found: {cmd[0]}")
        except subprocess.CalledProcessError as e:
            raise InstallError(f"Command failed (exit {e.returncode}): {' '.join(cmd)}")

    def write(self, path: Path, content: str, mode: int = 0o644, owner: bool = False) -> None:
        log.debug("write %s", path)
        if self.dry:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        path.chmod(mode)
        if owner:
            shutil.chown(path, self.pw.pw_uid, self.pw.pw_gid)

    def backup(self, path: Path) -> None:
        if not path.exists():
            return
        dest = path.with_name(f"{path.name}.bak.{dt.datetime.now():%Y%m%d-%H%M%S}")
        log.warning("Backing up %s -> %s", path, dest.name)
        if not self.dry:
            shutil.copy2(path, dest)

    # ---- pre-flight ------------------------------------------------------- #
    def preflight(self) -> None:
        self.step("Pre-flight checks")
        if os.geteuid() != 0:
            raise InstallError("Run as root (su - / sudo python3 install_edex.py).")
        if platform.machine() not in ("x86_64", "amd64"):
            raise InstallError(f"Unsupported architecture {platform.machine()} (x86_64 only).")
        try:
            osr = dict(l.strip().split("=", 1) for l in Path("/etc/os-release").read_text().splitlines() if "=" in l)
            if osr.get("ID") != "debian":
                log.warning("Not Debian (%s). Package names may differ.", osr.get("PRETTY_NAME", "unknown"))
            else:
                log.info("OS: %s", osr.get("PRETTY_NAME", "Debian").strip('"'))
        except OSError:
            log.warning("Cannot read /etc/os-release")
        if not shutil.which("systemctl"):
            raise InstallError("systemd not found (needed for auto-login).")
        log.info("Target user: %s (home: %s)", self.pw.pw_name, self.home)

    # ---- install ---------------------------------------------------------- #
    def install_packages(self) -> None:
        self.step("Installing graphical stack and Electron libraries")
        env = dict(os.environ, DEBIAN_FRONTEND="noninteractive")
        self.run(["apt-get", "update"], env=env)
        self.run(["apt-get", "install", "-y", "--no-install-recommends"] + PACKAGES, env=env)
        log.info("Packages installed")

    def download(self) -> None:
        self.step(f"Downloading eDEX-UI {VERSION}")
        if self.app_path.exists() and self.app_path.stat().st_size > MIN_SIZE_BYTES:
            log.info("Already present: %s (skipping download)", self.app_path)
        elif self.dry:
            log.debug("would download %s", URL)
        else:
            part = self.app_path.with_suffix(".part")
            try:
                req = urllib.request.Request(URL, headers={"User-Agent": "install_edex/1.0"})
                with urllib.request.urlopen(req, timeout=30) as r, open(part, "wb") as f:
                    total = int(r.headers.get("Content-Length", 0))
                    done, last = 0, 0.0
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                        done += len(chunk)
                        if total and time.time() - last > 0.5:
                            print(f"\r      {done / 1e6:7.1f} / {total / 1e6:.1f} MB ({done * 100 // total}%)", end="", flush=True)
                            last = time.time()
                    print()
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                part.unlink(missing_ok=True)
                raise InstallError(f"Download failed: {e}\n       Download it manually to {self.app_path} and re-run.")
            self.verify_and_place(part)
        if not self.dry:
            self.app_path.chmod(0o755)
            shutil.chown(self.app_path, self.pw.pw_uid, self.pw.pw_gid)
        log.info("AppImage ready: %s", self.app_path)

    def verify_and_place(self, part: Path) -> None:
        size = part.stat().st_size
        with open(part, "rb") as f:
            magic = f.read(4)
        if magic != b"\x7fELF" or size < MIN_SIZE_BYTES:
            part.unlink(missing_ok=True)
            raise InstallError("Downloaded file is not a valid AppImage (corrupt or blocked).")
        part.replace(self.app_path)

    def configure_xinitrc(self) -> None:
        self.step("Configuring ~/.xinitrc")
        if self.xinitrc.exists() and XINITRC_TAG not in self.xinitrc.read_text():
            self.backup(self.xinitrc)
        flags = ["--appimage-extract-and-run"]
        if self.args.no_sandbox:
            flags.append("--no-sandbox")
        content = f"{XINITRC_TAG}\nexec {self.app_path} {' '.join(flags)}\n"
        self.write(self.xinitrc, content, 0o755, owner=True)
        log.info("exec %s %s", self.app_path.name, " ".join(flags))

    # ---- autostart -------------------------------------------------------- #
    def profile_file(self) -> Path:
        """bash reads .bash_profile first if it exists, otherwise .profile."""
        bp = self.home / ".bash_profile"
        return bp if bp.exists() else self.home / ".profile"

    @staticmethod
    def strip_block(text: str) -> str:
        out, skip = [], False
        for line in text.splitlines():
            if line.strip() == MARK_BEGIN:
                skip = True
                continue
            if skip:
                if line.strip() == MARK_END:
                    skip = False
                continue
            out.append(line)
        return "\n".join(out).rstrip("\n") + ("\n" if out else "")

    def setup_autostart(self) -> None:
        self.step("Enabling boot autostart")
        # 1) auto-login on tty1
        drop_in = (
            "[Service]\n"
            "ExecStart=\n"
            f"ExecStart=-/sbin/agetty --autologin {self.pw.pw_name} --noclear %I $TERM\n"
        )
        self.write(AUTOLOGIN_CONF, drop_in)
        self.run(["systemctl", "daemon-reload"])
        log.info("Auto-login on tty1 as '%s'", self.pw.pw_name)

        # 2) startx from the login profile (tty1 only)
        target = self.profile_file()
        existing = target.read_text() if target.exists() else ""
        if MARK_BEGIN in existing:
            existing = self.strip_block(existing)
        block = (
            f"\n{MARK_BEGIN}\n"
            'if [ -z "${DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then\n'
            "    startx\n"
            "fi\n"
            f"{MARK_END}\n"
        )
        if existing and not self.dry:
            self.backup(target)
        self.write(target, existing + block, 0o644, owner=True)
        log.info("startx hook added to %s", target)

    # ---- uninstall -------------------------------------------------------- #
    def uninstall(self) -> None:
        self.step("Removing autostart")
        if AUTOLOGIN_CONF.exists():
            log.info("Removing %s", AUTOLOGIN_CONF)
            if not self.dry:
                AUTOLOGIN_CONF.unlink()
                try:
                    AUTOLOGIN_DIR.rmdir()
                except OSError:
                    pass
            self.run(["systemctl", "daemon-reload"])
        for f in (self.home / ".bash_profile", self.home / ".profile"):
            if f.exists() and MARK_BEGIN in f.read_text():
                self.backup(f)
                self.write(f, self.strip_block(f.read_text()), 0o644, owner=True)
                log.info("Removed startx hook from %s", f)
        if self.xinitrc.exists() and XINITRC_TAG in self.xinitrc.read_text():
            log.info("Removing %s", self.xinitrc)
            if not self.dry:
                self.xinitrc.unlink()
        if self.args.purge:
            self.step("Purging files")
            cfg = self.home / ".config" / "eDEX-UI"
            if not self.dry:
                self.app_path.unlink(missing_ok=True)
                shutil.rmtree(cfg, ignore_errors=True)
            log.info("Deleted AppImage and %s", cfg)
        log.info("Uninstall complete. Packages (xorg, openbox, ...) were left installed.")

    # ---- summary ---------------------------------------------------------- #
    def summary(self) -> None:
        print("\n" + Colors.c("1;32", "Installation complete.") + (" (dry run, nothing changed)" if self.dry else ""))
        if self.args.autostart:
            print("  Reboot to start straight into eDEX-UI:   reboot")
        else:
            print(f"  Start manually as {self.pw.pw_name}:   startx")
        print("  Exit eDEX-UI:        Ctrl+Shift+Q  (returns to the tty1 shell)")
        print("  Other console:       Ctrl+Alt+F2")
        print("  Undo everything:     python3 install_edex.py --uninstall")
        if self.pw.pw_name == "root":
            print(Colors.c("33", "  Security: auto-login as root + unmaintained app. Protect the machine physically / encrypt the disk."))

    def install(self) -> None:
        self.preflight()
        self.install_packages()
        self.download()
        self.configure_xinitrc()
        if self.args.autostart:
            self.setup_autostart()
        self.summary()


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Install eDEX-UI as the primary interface on a Debian CLI system.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--user", default="root", help="existing user that will run the GUI")
    p.add_argument("--no-autostart", dest="autostart", action="store_false",
                   help="skip auto-login and startx-at-boot (install only)")
    p.add_argument("--sandbox", dest="no_sandbox", action="store_false",
                   help="do NOT pass --no-sandbox (not possible when running as root)")
    p.add_argument("--dry-run", action="store_true", help="print actions without changing anything")
    p.add_argument("--uninstall", action="store_true", help="remove autostart/autologin and generated files")
    p.add_argument("--purge", action="store_true", help="with --uninstall: also delete AppImage and config")
    p.add_argument("-v", "--verbose", action="store_true", help="show every command and file write")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(Fmt())
    log.addHandler(handler)
    log.setLevel(logging.DEBUG if (args.verbose or args.dry_run) else logging.INFO)

    try:
        if os.geteuid() != 0:
            raise InstallError("Run as root (su - / sudo python3 install_edex.py).")
        inst = Installer(args)
        if args.user == "root" and not args.no_sandbox:
            raise InstallError("Electron refuses to run as root without --no-sandbox.")
        inst.uninstall() if args.uninstall else inst.install()
    except InstallError as e:
        log.error("%s", e)
        return 1
    except KeyboardInterrupt:
        log.error("Interrupted")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
