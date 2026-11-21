#!/usr/bin/env python3
"""
edex_troubleshoot.py - diagnose and fix the "black screen" problem with eDEX-UI on Debian CLI.

Compatible with install_edex.py (same autostart markers). Run as root from a real
console (tty1/tty2), not over SSH, because the "test" step starts X on the local screen.

Commands:
    python3 edex_troubleshoot.py autostart-off   # stop boot autologin + startx (safe mode)
    python3 edex_troubleshoot.py diagnose        # collect system/GPU/Xorg info -> report file
    python3 edex_troubleshoot.py drivers         # install video drivers matching your hardware/VM
    python3 edex_troubleshoot.py fix-gpu         # add --disable-gpu flags to ~/.xinitrc
    python3 edex_troubleshoot.py test            # run startx and log the result
    python3 edex_troubleshoot.py autostart-on    # re-enable boot autostart
    python3 edex_troubleshoot.py all             # autostart-off -> diagnose -> drivers -> fix-gpu -> test
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path(os.environ.get("EDEX_HOME", "/root"))
XINITRC = HOME / ".xinitrc"
REPORT = HOME / "edex_report.txt"
STARTX_LOG = HOME / "startx.log"
GPU_FLAGS = ["--disable-gpu", "--in-process-gpu"]

MARK_BEGIN = "# >>> edex-ui autostart (managed by install_edex.py) >>>"
MARK_END = "# <<< edex-ui autostart <<<"
AUTOLOGIN_DIR = Path("/etc/systemd/system/getty@tty1.service.d")
AUTOLOGIN_CONF = AUTOLOGIN_DIR / "edex-autologin.conf"

XORG_LOGS = [
    HOME / ".local/share/xorg/Xorg.0.log",
    Path("/var/log/Xorg.0.log"),
]

DRIVER_PACKAGES = {
    "vmware": (["xserver-xorg-video-vmware", "open-vm-tools"], "VMware"),
    "oracle": (["xserver-xorg-video-vmware"], "VirtualBox"),
    "kvm": (["xserver-xorg-video-qxl", "spice-vdagent"], "KVM/QEMU/Proxmox"),
    "qemu": (["xserver-xorg-video-qxl", "spice-vdagent"], "QEMU"),
    "microsoft": (["xserver-xorg-video-fbdev"], "Hyper-V"),
}
OPTIONAL_PACKAGES = {  # tried one by one, failure is not fatal (may need contrib/non-free)
    "oracle": ["virtualbox-guest-x11"],
}
FALLBACK_PACKAGES = ["xserver-xorg-video-fbdev", "xserver-xorg-video-vesa"]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def c(code: str, s: str) -> str:
    return f"\033[{code}m{s}\033[0m" if sys.stdout.isatty() else s


def step(t: str) -> None:
    print("\n" + c("1;36", f"== {t}"))


def ok(m: str) -> None:
    print(f"{c('32', '[ OK ]')} {m}")


def warn(m: str) -> None:
    print(f"{c('33', '[WARN]')} {m}")


def fail(m: str) -> None:
    print(f"{c('31', '[FAIL]')} {m}")


def sh(cmd: list[str], timeout: int | None = 60) -> tuple[int, str]:
    """Run a command, return (exit code, combined output). Never raises."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr).strip()
    except FileNotFoundError:
        return 127, f"command not found: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 124, "timeout"


def confirm(q: str) -> bool:
    try:
        return input(f"{q} [y/N]: ").strip().lower() in ("y", "yes", "ن", "نعم")
    except EOFError:
        return False


def detect_virt() -> str:
    _, out = sh(["systemd-detect-virt"])
    return out.splitlines()[0].strip() if out else "none"


def gpu_info() -> str:
    _, out = sh(["lspci"])
    lines = [l for l in out.splitlines() if re.search(r"vga|3d|display", l, re.I)]
    return "\n".join(lines) if lines else "(no GPU line found - lspci missing? apt install pciutils)"


def backup(path: Path) -> None:
    if path.exists():
        dest = path.with_name(f"{path.name}.bak.{dt.datetime.now():%Y%m%d-%H%M%S}")
        shutil.copy2(path, dest)
        ok(f"Backup: {dest}")


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


def profile_file() -> Path:
    bp = HOME / ".bash_profile"
    return bp if bp.exists() else HOME / ".profile"


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #
def autostart_off() -> None:
    step("Disabling boot autostart (safe mode)")
    if AUTOLOGIN_CONF.exists():
        AUTOLOGIN_CONF.unlink()
        try:
            AUTOLOGIN_DIR.rmdir()
        except OSError:
            pass
        sh(["systemctl", "daemon-reload"])
        ok("Auto-login drop-in removed")
    else:
        ok("No auto-login drop-in found")

    removed = False
    for f in (HOME / ".bash_profile", HOME / ".profile"):
        if f.exists() and MARK_BEGIN in f.read_text():
            backup(f)
            f.write_text(strip_block(f.read_text()))
            ok(f"startx hook removed from {f}")
            removed = True
    # Also catch the older manual hook from the first tutorial
    for f in (HOME / ".bash_profile", HOME / ".profile"):
        if f.exists() and re.search(r"^\s*startx\s*$", f.read_text(), re.M):
            warn(f"{f} still contains a manual 'startx' line - remove it by hand if boot still enters X")
    if not removed:
        ok("No managed startx hook found")
    print("Next boot will land on a normal login prompt.")


def autostart_on() -> None:
    step("Enabling boot autostart")
    if not XINITRC.exists():
        fail(f"{XINITRC} not found - run install_edex.py first")
        return
    AUTOLOGIN_DIR.mkdir(parents=True, exist_ok=True)
    AUTOLOGIN_CONF.write_text(
        "[Service]\nExecStart=\nExecStart=-/sbin/agetty --autologin root --noclear %I $TERM\n"
    )
    sh(["systemctl", "daemon-reload"])
    ok("Auto-login on tty1 enabled")

    target = profile_file()
    existing = target.read_text() if target.exists() else ""
    if MARK_BEGIN in existing:
        existing = strip_block(existing)
    block = (
        f"\n{MARK_BEGIN}\n"
        'if [ -z "${DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then\n'
        "    startx\n"
        "fi\n"
        f"{MARK_END}\n"
    )
    backup(target)
    target.write_text(existing + block)
    ok(f"startx hook added to {target}")
    print("Reboot to test. If it goes black again: Ctrl+Alt+F2 then run 'autostart-off'.")


def diagnose() -> None:
    step("Collecting diagnostics")
    sections: list[tuple[str, str]] = []

    sections.append(("Virtualization", detect_virt()))
    sections.append(("GPU (lspci)", gpu_info()))
    sections.append(("Kernel DRM / framebuffer messages", sh(["bash", "-c", "dmesg | grep -iE 'drm|gpu|fb0|framebuffer' | tail -25"])[1] or "(none)"))
    sections.append(("Video devices", sh(["bash", "-c", "ls -l /dev/dri /dev/fb0 2>&1"])[1]))
    sections.append(("Installed X video drivers", sh(["bash", "-c", "dpkg -l | grep -E 'xserver-xorg-video|xserver-xorg-core|open-vm|spice-vdagent' | awk '{print $2, $3}'"])[1] or "(none)"))
    sections.append(("~/.xinitrc", XINITRC.read_text() if XINITRC.exists() else "(missing)"))

    log_found = False
    for lg in XORG_LOGS:
        if lg.exists():
            log_found = True
            errs = [l for l in lg.read_text(errors="replace").splitlines()
                    if re.search(r"\(EE\)|Fatal|no screens|Cannot run in framebuffer", l)]
            sections.append((f"Xorg errors in {lg}", "\n".join(errs[:30]) or "(no errors logged)"))
    if not log_found:
        sections.append(("Xorg log", "(no Xorg log found - X may never have started)"))

    if STARTX_LOG.exists():
        sections.append((f"Tail of {STARTX_LOG}", "\n".join(STARTX_LOG.read_text(errors="replace").splitlines()[-25:])))

    sections.append(("Last boot errors (journal)", sh(["bash", "-c", "journalctl -b -p err --no-pager | tail -20"])[1] or "(none)"))

    report = "\n\n".join(f"### {t}\n{b}" for t, b in sections)
    REPORT.write_text(report + "\n")
    print(report)
    ok(f"Report saved to {REPORT} (send me this file or its content)")


def drivers() -> None:
    step("Installing video drivers")
    virt = detect_virt()
    gpu = gpu_info()
    print(f"Virtualization: {virt}\nGPU: {gpu}")

    pkgs: list[str]
    if virt in DRIVER_PACKAGES:
        pkgs, label = DRIVER_PACKAGES[virt]
        print(f"Detected: {label}")
    elif virt == "none":
        pkgs = list(FALLBACK_PACKAGES)
        if re.search(r"nvidia", gpu, re.I):
            pkgs.append("firmware-misc-nonfree")
        elif re.search(r"amd|ati|radeon", gpu, re.I):
            pkgs.append("firmware-amd-graphics")
        elif re.search(r"intel", gpu, re.I):
            pkgs.append("firmware-intel-graphics")
        print("Detected: physical machine")
    else:
        pkgs = list(FALLBACK_PACKAGES)
        warn(f"Unknown environment '{virt}', using generic fallback drivers")

    env = dict(os.environ, DEBIAN_FRONTEND="noninteractive")
    subprocess.run(["apt-get", "update"], env=env)
    for pkg in pkgs + OPTIONAL_PACKAGES.get(virt, []):
        rc = subprocess.run(["apt-get", "install", "-y", pkg], env=env).returncode
        (ok if rc == 0 else warn)(f"{pkg}" + ("" if rc == 0 else " - not installed (not in enabled repos?)"))
    print("Hint: firmware-* packages live in 'non-free-firmware'. Enable it in /etc/apt/sources.list if missing.")


def fix_gpu() -> None:
    step("Adding GPU-safe flags to ~/.xinitrc")
    if not XINITRC.exists():
        fail(f"{XINITRC} not found - run install_edex.py first")
        return
    text = XINITRC.read_text()
    if all(f in text for f in GPU_FLAGS):
        ok("Flags already present")
        return
    backup(XINITRC)
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("exec ") and "AppImage" in line:
            extra = " ".join(f for f in GPU_FLAGS if f not in line)
            lines[i] = f"{line} {extra}"
            break
    else:
        fail("Could not find the 'exec ...AppImage' line to patch")
        return
    XINITRC.write_text("\n".join(lines) + "\n")
    ok(f"Updated: {lines[i]}")


def test() -> None:
    step("Test run: startx (output logged)")
    if not sys.stdin.isatty():
        fail("Not on a console. Run this from tty1/tty2 directly, not over SSH.")
        return
    if os.environ.get("DISPLAY"):
        fail("Already inside a graphical session.")
        return
    sh(["pkill", "-f", "eDEX-UI"])
    sh(["pkill", "Xorg"])
    print("Starting X now. If eDEX-UI appears, close it with Ctrl+Shift+Q to come back here.")
    print("If the screen stays black: wait ~20s, press Ctrl+Alt+F2, log in and re-run 'diagnose'.\n")
    with open(STARTX_LOG, "w") as f:
        rc = subprocess.run(["startx"], stdout=f, stderr=subprocess.STDOUT).returncode
    tail = "\n".join(STARTX_LOG.read_text(errors="replace").splitlines()[-25:])
    print(f"\nstartx exited with code {rc}. Last lines of {STARTX_LOG}:\n{tail}")
    if rc == 0:
        ok("X session ended normally")
    else:
        warn("X ended with an error - run 'diagnose' and review the report")


def run_all() -> None:
    autostart_off()
    diagnose()
    if confirm("Install video drivers for this hardware/VM?"):
        drivers()
    fix_gpu()
    if confirm("Run the startx test now?"):
        test()
    print("\nIf eDEX-UI worked, run:  python3 edex_troubleshoot.py autostart-on")


COMMANDS = {
    "autostart-off": autostart_off,
    "autostart-on": autostart_on,
    "diagnose": diagnose,
    "drivers": drivers,
    "fix-gpu": fix_gpu,
    "test": test,
    "all": run_all,
}


def main() -> int:
    ap = argparse.ArgumentParser(description="Troubleshoot eDEX-UI black screen on Debian CLI.")
    ap.add_argument("command", choices=COMMANDS, help="what to run")
    args = ap.parse_args()
    if os.geteuid() != 0:
        fail("Run as root.")
        return 1
    try:
        COMMANDS[args.command]()
    except KeyboardInterrupt:
        fail("Interrupted")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
