#!/usr/bin/env python3
"""Install concrete GitHub projects listed in the OSINT catalogues.

Designed for Debian/Ubuntu. It is intentionally conservative:
* topic pages and placeholder github.com links are skipped;
* each repository is cloned once;
* Python dependencies are installed in one isolated virtual environment;
* Kali's well-known APT packages are attempted individually when --yes is used;
* failures are logged and do not prevent the remaining tools from being tried.

Run:
    python3 install_osint_tools.py --source github_osint_tools_3_categories.md --yes

Use --dry-run first. Review third-party code and use these tools only for
authorized, lawful OSINT and validation work.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


REPO_RE = re.compile(r"https?://github\.com/([^/\s]+)/([^/\s)]+)", re.I)
SKIP_SUFFIXES = ("/topics/", "/search", "/collections/")
APT_PACKAGES = {
    "python": ["python3", "python3-venv", "python3-pip", "git", "ca-certificates"],
    "go": ["golang-go"],
    "rust": ["cargo", "rustc"],
    "node": ["nodejs", "npm"],
    "java": ["default-jdk", "maven", "gradle"],
    "php": ["php", "composer"],
    "dotnet": ["dotnet-sdk-8.0"],
}
KALI_APT_TOOLS = ["sherlock", "maigret", "holehe", "theharvester", "recon-ng", "spiderfoot"]

# Concrete additions from the pasted Kali Linux OSINT directory. The other
# pasted entries already occur in the Markdown source and are deduplicated.
KALI_SUPPLEMENTAL_REPOSITORIES = [
    ("https://github.com/antoniaci/blackbird", "blackbird"),
    ("https://github.com/maldevel/EmailHarvester", "EmailHarvester"),
]


@dataclass
class Result:
    name: str
    url: str
    status: str
    detail: str = ""


def run(cmd: list[str], *, cwd: Path | None = None, dry_run: bool = False) -> tuple[int, str]:
    print("$", " ".join(cmd))
    if dry_run:
        return 0, "dry-run"
    proc = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout[-4000:]


def is_debian() -> bool:
    if shutil.which("dpkg") is None:
        return False
    try:
        text = Path("/etc/os-release").read_text(encoding="utf-8").lower()
    except OSError:
        return False
    return "debian" in text or "ubuntu" in text or "linuxmint" in text


def extract_repositories(markdown: str) -> list[tuple[str, str]]:
    found: dict[str, tuple[str, str]] = {}
    for match in REPO_RE.finditer(markdown):
        owner, repo = match.group(1), match.group(2).rstrip("`.,;:)")
        url = f"https://github.com/{owner}/{repo}"
        if any(part in url.lower() + "/" for part in SKIP_SUFFIXES):
            continue
        if repo.lower() in {"", "osint", "national-id", "iban", "iban-validator"}:
            continue
        found.setdefault(f"{owner.lower()}/{repo.lower()}", (url, repo))
    return list(found.values())


def merge_repositories(*groups: Iterable[tuple[str, str]]) -> list[tuple[str, str]]:
    merged: dict[str, tuple[str, str]] = {}
    for group in groups:
        for url, name in group:
            key = url.rstrip("/").lower()
            merged.setdefault(key, (url.rstrip("/"), name))
    return list(merged.values())


def github_exists(url: str, dry_run: bool) -> bool:
    if dry_run:
        return True
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "osint-tool-installer"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def detect_languages(repo_dir: Path) -> set[str]:
    names = {p.name.lower() for p in repo_dir.iterdir()} if repo_dir.exists() else set()
    langs: set[str] = set()
    if {"pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"} & names:
        langs.add("python")
    if "go.mod" in names:
        langs.add("go")
    if "cargo.toml" in names:
        langs.add("rust")
    if {"package.json", "npm-shrinkwrap.json", "yarn.lock"} & names:
        langs.add("node")
    if {"pom.xml", "build.gradle", "build.gradle.kts"} & names:
        langs.add("java")
    if "composer.json" in names or any(p.suffix == ".php" for p in repo_dir.rglob("*.php")):
        langs.add("php")
    if any(p.suffix == ".csproj" for p in repo_dir.rglob("*.csproj")) or any(p.suffix == ".sln" for p in repo_dir.rglob("*.sln")):
        langs.add("dotnet")
    return langs


def apt_install(packages: Iterable[str], yes: bool, dry_run: bool) -> None:
    packages = sorted(set(packages))
    if not packages:
        return
    if not yes and not dry_run:
        print("Skipping APT dependencies (pass --yes to allow sudo apt-get).")
        return
    prefix = [] if os.geteuid() == 0 else ["sudo"]
    run(prefix + ["apt-get", "update"], dry_run=dry_run)
    # Install independently so an unavailable package in one ecosystem does
    # not prevent Python, Git, or the other language runtimes from installing.
    for package in packages:
        code, output = run(prefix + ["apt-get", "install", "-y", package], dry_run=dry_run)
        if code != 0:
            print(f"APT warning: could not install {package}: {output}")


def install_repo(url: str, display_name: str, root: Path, venv: Path, dry_run: bool) -> Result:
    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", url.rstrip("/").split("/")[-2] + "_" + url.rstrip("/").split("/")[-1])
    target = root / safe_name
    if target.exists() and (target / ".git").exists():
        code, out = run(["git", "-C", str(target), "pull", "--ff-only"], dry_run=dry_run)
    else:
        code, out = run(["git", "clone", "--depth", "1", url, str(target)], dry_run=dry_run)
    if code != 0:
        return Result(display_name, url, "failed", f"git: {out}")

    langs = detect_languages(target) if not dry_run else set()
    commands: list[list[str]] = []
    if "python" in langs:
        pip = str(venv / "bin" / "pip")
        for req in ("requirements.txt", "requirements-dev.txt"):
            if (target / req).exists():
                commands.append([pip, "install", "-r", str(target / req)])
        if (target / "pyproject.toml").exists() or (target / "setup.py").exists():
            commands.append([pip, "install", "-e", str(target)])
    if "node" in langs:
        commands.append(["npm", "install", "--prefix", str(target)])
    if "go" in langs:
        commands.append(["go", "install", "./..." ])
    if "rust" in langs:
        commands.append(["cargo", "build", "--release", "--manifest-path", str(target / "Cargo.toml")])
    if "java" in langs:
        if (target / "pom.xml").exists():
            commands.append(["mvn", "-q", "-DskipTests", "package"])
        elif (target / "gradlew").exists():
            commands.append(["./gradlew", "build", "-x", "test"])
    if "php" in langs and (target / "composer.json").exists():
        commands.append(["composer", "install", "--no-interaction", "--working-dir", str(target)])
    if "dotnet" in langs:
        commands.append(["dotnet", "build", str(target)])

    for command in commands:
        code, out = run(command, cwd=target if command[0] in {"go", "mvn", "./gradlew"} else None, dry_run=dry_run)
        if code != 0:
            return Result(display_name, url, "partial", f"{command[0]}: {out}")
    return Result(display_name, url, "installed", ", ".join(sorted(langs)) or "no recognized build files")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("github_osint_tools_3_categories.md"))
    parser.add_argument("--directory", type=Path, default=Path("OSINT"))
    parser.add_argument("--yes", action="store_true", help="allow sudo apt-get for missing runtimes")
    parser.add_argument("--no-apt", action="store_true", help="never attempt APT installation")
    parser.add_argument("--skip-kali-packages", action="store_true", help="do not attempt Kali APT tool packages")
    parser.add_argument("--dry-run", action="store_true", help="show actions without changing the system")
    args = parser.parse_args()

    if sys.platform != "linux" or not is_debian():
        print("This installer targets Debian/Ubuntu Linux. Run it on the Debian machine.", file=sys.stderr)
        return 2
    if not args.source.exists():
        print(f"Markdown source not found: {args.source}", file=sys.stderr)
        return 2

    repositories = merge_repositories(
        extract_repositories(args.source.read_text(encoding="utf-8")),
        KALI_SUPPLEMENTAL_REPOSITORIES,
    )
    print(f"Found {len(repositories)} unique concrete repositories; topic/placeholder links were skipped.")
    args.directory.mkdir(parents=True, exist_ok=True)
    (args.directory / "repositories").mkdir(parents=True, exist_ok=True)
    if not args.no_apt:
        # Install the common Debian runtimes up front. This avoids creating a
        # venv with a missing interpreter and lets mixed-language repositories
        # build without stopping the whole run.
        apt_install(
            [package for packages in APT_PACKAGES.values() for package in packages],
            args.yes,
            args.dry_run,
        )
        if not args.skip_kali_packages:
            apt_install(KALI_APT_TOOLS, args.yes, args.dry_run)
    venv = args.directory / ".venv"
    if not venv.exists():
        run([sys.executable, "-m", "venv", str(venv)], dry_run=args.dry_run)

    results: list[Result] = []
    for url, name in repositories:
        print(f"\n=== {name} ===")
        if not github_exists(url, args.dry_run):
            results.append(Result(name, url, "skipped", "repository URL returned no successful response"))
            continue
        results.append(install_repo(url, name, args.directory / "repositories", venv, args.dry_run))

    report = args.directory / "install-report.json"
    if not args.dry_run:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps([asdict(r) for r in results], indent=2), encoding="utf-8")
    print("\nSummary:")
    for result in results:
        print(f"[{result.status:9}] {result.name}: {result.detail}")
    print(f"\nReport: {report}")
    return 0 if all(r.status == "installed" for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
