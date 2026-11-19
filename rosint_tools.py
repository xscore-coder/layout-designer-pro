#!/usr/bin/env python3
"""Install concrete GitHub projects listed in the OSINT catalogues.

Designed for Debian/Ubuntu. It is intentionally conservative:
* topic pages and placeholder github.com links are skipped;
* each repository is cloned once;
* each Python repository gets its own isolated virtual environment;
* Kali-only APT package names are attempted only with --install-kali-apt;
* failures are logged and do not prevent the remaining tools from being tried.

Run (as a normal user with sudo, or as root):
    python3 install_osint_tools.py --yes
    python3 install_osint_tools.py --dry-run --no-apt

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
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


REPO_RE = re.compile(r"https?://(?:www\.)?github\.com/([^/\s]+)/([^/\s)]+)", re.I)
APT_PACKAGES = {
    "python": ["python3", "python3-venv", "python3-pip", "git", "ca-certificates"],
    "go": ["golang-go"],
    "rust": ["cargo", "rustc"],
    "node": ["nodejs", "npm"],
    "java": ["default-jdk", "maven", "gradle"],
    "php": ["php", "composer"],
    "dotnet": ["dotnet-sdk-8.0"],
    "ruby": ["ruby", "ruby-bundler"],
}
NON_REPO_OWNERS = {"topics", "search", "collections", "orgs", "sponsors", "features", "marketplace",
                   "settings", "login", "about", "pricing", "trending", "explore", "apps", "users"}
KALI_APT_TOOLS = ["sherlock", "maigret", "holehe", "theharvester", "recon-ng", "spiderfoot"]

BUILTIN_REPOSITORIES = [
    ("https://github.com/sundowndev/phoneinfoga", "phoneinfoga"),
    ("https://github.com/megadose/ignorant", "ignorant"),
    ("https://github.com/google/libphonenumber", "libphonenumber"),
    ("https://github.com/daviddrysdale/python-phonenumbers", "python-phonenumbers"),
    ("https://github.com/megadose/holehe", "holehe"),
    ("https://github.com/mxrch/GHunt", "GHunt"),
    ("https://github.com/khast3x/h8mail", "h8mail"),
    ("https://github.com/alpkeskin/mosint", "mosint"),
    ("https://github.com/laramies/theHarvester", "theHarvester"),
    ("https://github.com/Ekultek/WhatBreach", "WhatBreach"),
    ("https://github.com/thewhiteh4t/pwnedOrNot", "pwnedOrNot"),
    ("https://github.com/sharsil/mailcat", "mailcat"),
    ("https://github.com/lanmaster53/recon-ng", "recon-ng"),
    ("https://github.com/smicallef/spiderfoot", "spiderfoot"),
    ("https://github.com/iojw/socialscan", "socialscan"),
    ("https://github.com/sherlock-project/sherlock", "sherlock"),
    ("https://github.com/soxoj/maigret", "maigret"),
    ("https://github.com/antoniaci/blackbird", "blackbird"),
    ("https://github.com/WebBreacher/WhatsMyName", "WhatsMyName"),
    ("https://github.com/thewhiteh4t/nexfil", "nexfil"),
    ("https://github.com/snooppr/snoop", "snoop"),
    ("https://github.com/qeeqbox/social-analyzer", "social-analyzer"),
    ("https://github.com/urbanadventurer/username-anarchy", "username-anarchy"),
    ("https://github.com/lockfale/OSINT-Framework", "OSINT-Framework"),
    ("https://github.com/osintshifu/awesome-osint-repos", "awesome-osint-repos"),
    ("https://github.com/DataSploit/datasploit", "datasploit"),
    ("https://github.com/MohamedAAbdallah/Egyptian-ID-Validator", "Egyptian-ID-Validator"),
    ("https://github.com/predev-solutions/egypt-validators", "egypt-validators"),
    ("https://github.com/arthurdejong/python-stdnum", "python-stdnum"),
    ("https://github.com/jmbg-labs/go", "go"),
    ("https://github.com/jmbg-labs/python", "python"),
    ("https://github.com/globalcitizen/php-iban", "php-iban"),
    ("https://github.com/Simplify/ibantools", "ibantools"),
    ("https://github.com/skwasjer/IbanNet", "IbanNet"),
    ("https://github.com/mdomke/schwifty", "schwifty"),
    ("https://github.com/ThomasdenH/iban_validate", "iban_validate"),
    ("https://github.com/ericqu/iban_validation", "iban_validation"),
    ("https://github.com/barend/java-iban", "java-iban"),
    ("https://github.com/gocardless/ibandit", "ibandit"),
    ("https://github.com/smohamadabedy/shaba", "shaba"),
    ("https://github.com/maldevel/EmailHarvester", "EmailHarvester"),
]
REPOSITORY_ALIASES = {
    "https://github.com/p1ngul1n0/blackbird": "https://github.com/antoniaci/blackbird",
}
INVALID_REPOSITORIES = {
    "https://github.com/entynetproject/phunter",
    "https://github.com/sublime-security/emailrep",
    "https://github.com/rog3rsm1th/profil3r",
    "https://github.com/soxoj/glit",
    "https://github.com/persian-tools/persian-tools",
    "https://github.com/iban4j/iban4j",
    "https://github.com/arhs/iban.js",
}


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
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=1800,
        )
        return proc.returncode, proc.stdout[-4000:]
    except FileNotFoundError:
        return 127, f"command not found: {cmd[0]}"
    except subprocess.TimeoutExpired as exc:
        partial = exc.output.decode("utf-8", "replace") if isinstance(exc.output, bytes) else (exc.output or "")
        return 124, f"command timed out after 1800 seconds: {cmd[0]}\n{partial[-2000:]}"
    except OSError as exc:
        return 126, f"could not execute {cmd[0]}: {exc}"


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
        owner = match.group(1)
        repo = match.group(2).split("#", 1)[0].split("?", 1)[0].rstrip("`.,;:)>\"'")
        repo = repo.removesuffix(".git")
        url = f"https://github.com/{owner}/{repo}"
        path_parts = url.lower().split("/")
        if len(path_parts) > 4 and path_parts[3] in {"topics", "search", "collections"}:
            continue
        if owner.lower() in NON_REPO_OWNERS or not owner or not repo or repo.lower() in {"topics", "search", "collections"}:
            continue
        found.setdefault(f"{owner.lower()}/{repo.lower()}", (url, repo))
    return list(found.values())


def merge_repositories(*groups: Iterable[tuple[str, str]]) -> list[tuple[str, str]]:
    merged: dict[str, tuple[str, str]] = {}
    for group in groups:
        for url, name in group:
            url = REPOSITORY_ALIASES.get(url.rstrip("/").lower(), url.rstrip("/"))
            if url.lower() in INVALID_REPOSITORIES:
                continue
            key = url.rstrip("/").lower()
            merged.setdefault(key, (url.rstrip("/"), name))
    return list(merged.values())


def repository_files(repo_dir: Path) -> list[Path]:
    ignored = {".git", ".venv", "venv", "node_modules", "vendor", "target", "dist", "build"}
    files = []
    for path in repo_dir.rglob("*"):
        if path.is_file() and not ignored.intersection(path.relative_to(repo_dir).parts[:-1]):
            files.append(path)
    return files


def detect_languages(repo_dir: Path) -> set[str]:
    files = repository_files(repo_dir)
    names = {p.name.lower() for p in files}
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
    if "composer.json" in names or any(p.suffix.lower() == ".php" for p in files):
        langs.add("php")
    if any(p.suffix.lower() in {".csproj", ".sln"} for p in files):
        langs.add("dotnet")
    if "gemfile" in names or any(p.suffix.lower() == ".gemspec" for p in files):
        langs.add("ruby")
    return langs


def python_requirement_files(repo_dir: Path) -> list[Path]:
    """Return only conventional top-level Python dependency files."""
    candidates = ("requirements.txt", "requirements-dev.txt")
    return [repo_dir / name for name in candidates if (repo_dir / name).is_file()]


def apt_install(packages: Iterable[str], yes: bool, dry_run: bool, *, update: bool = True) -> bool:
    packages = sorted(set(packages))
    if not packages:
        return True
    if not yes and not dry_run:
        print("Skipping APT dependencies (pass --yes to allow sudo apt-get).")
        return True
    prefix = [] if os.geteuid() == 0 else ["sudo", "-n"]
    if update:
        update_code, update_output = run(prefix + ["apt-get", "update"], dry_run=dry_run)
        if update_code != 0:
            print(f"APT update failed: {update_output}")
            return False
    # Install independently so an unavailable package in one ecosystem does
    # not prevent Python, Git, or the other language runtimes from installing.
    failed = []
    for package in packages:
        if not dry_run:
            rc, status = run(["dpkg-query", "-W", "-f=${Status}", package])
            if rc == 0 and "install ok installed" in status:
                continue
        code, output = run(prefix + ["apt-get", "install", "-y", package], dry_run=dry_run)
        if code != 0:
            print(f"APT warning: could not install {package}: {output}")
            failed.append(package)
    if failed:
        print("APT dependency phase failed for: " + ", ".join(failed))
    return not failed


def install_repo(
    url: str,
    display_name: str,
    root: Path,
    dry_run: bool,
    include_dev: bool = False,
    with_submodules: bool = False,
    allow_npm_scripts: bool = False,
    apt_yes: bool = False,
) -> Result:
    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", url.rstrip("/").split("/")[-2] + "_" + url.rstrip("/").split("/")[-1])
    target = root / safe_name
    if dry_run:
        return Result(display_name, url, "planned", "clone, dependency installation, and verification not executed")
    if target.exists() and (target / ".git").exists():
        code, out = run(["git", "-C", str(target), "pull", "--ff-only"], dry_run=dry_run)
    else:
        clone_command = ["git", "clone", "--depth", "1"]
        if with_submodules:
            clone_command += ["--recurse-submodules", "--shallow-submodules"]
        clone_command += [url, str(target)]
        code, out = run(clone_command)
    if code != 0:
        return Result(display_name, url, "failed", f"git: {out}")
    if with_submodules:
        code, out = run(["git", "-C", str(target), "submodule", "update", "--init", "--recursive"])
        if code != 0:
            return Result(display_name, url, "partial", f"submodules: {out}")

    langs = detect_languages(target)
    files = repository_files(target)
    def first_named(name: str) -> Path | None:
        return next((path for path in files if path.name.lower() == name.lower()), None)
    repo_venv = target / ".venv"
    if "python" in langs:
        pip_path = repo_venv / "bin" / "pip"
        if not pip_path.is_file():
            code, out = run([sys.executable, "-m", "venv", str(repo_venv)])
            if code != 0 or not pip_path.is_file():
                return Result(display_name, url, "failed", f"venv: {out}")
    runtime_packages = {
        "go": ("go", APT_PACKAGES["go"]),
        "rust": ("cargo", APT_PACKAGES["rust"]),
        "node": ("npm", APT_PACKAGES["node"]),
        "java": ("mvn", APT_PACKAGES["java"]),
        "php": ("composer", APT_PACKAGES["php"]),
        "ruby": ("bundle", APT_PACKAGES["ruby"]),
        "dotnet": ("dotnet", APT_PACKAGES["dotnet"]),
    }
    missing_runtimes = []
    for language in sorted(langs):
        runtime = runtime_packages.get(language)
        if runtime and shutil.which(runtime[0]) is None:
            if apt_yes:
                apt_install(runtime[1], True, False, update=False)
            if shutil.which(runtime[0]) is None:
                missing_runtimes.append(language)
    if missing_runtimes:
        print(f"{display_name}: missing runtime(s): {', '.join(missing_runtimes)}")
    commands: list[list[str]] = []
    if "python" in langs:
        pip = str(repo_venv / "bin" / "pip")
        for req in python_requirement_files(target):
            if req.name == "requirements-dev.txt" and not include_dev:
                continue
            commands.append([pip, "install", "-r", str(req)])
        if any((target / marker).exists() for marker in ("pyproject.toml", "setup.py", "setup.cfg")):
            commands.append([pip, "install", "-e", str(target)])
    if "node" in langs:
        if (target / "package-lock.json").exists() or (target / "npm-shrinkwrap.json").exists():
            commands.append(["npm", "ci", *([] if allow_npm_scripts else ["--ignore-scripts"]), "--prefix", str(target)])
        else:
            commands.append(["npm", "install", *([] if allow_npm_scripts else ["--ignore-scripts"]), "--prefix", str(target)])
    if "go" in langs:
        commands.append(["go", "mod", "download"])
        commands.append(["go", "install", "./..."])
    if "rust" in langs:
        manifest = first_named("Cargo.toml")
        if manifest:
            commands.append(["cargo", "fetch", "--manifest-path", str(manifest)])
            commands.append(["cargo", "build", "--release", "--manifest-path", str(manifest)])
    if "java" in langs:
        pom = first_named("pom.xml")
        gradlew = first_named("gradlew")
        if pom:
            commands.append(["mvn", "-q", "-DskipTests", "dependency:go-offline", "-f", str(pom)])
            commands.append(["mvn", "-q", "-DskipTests", "package", "-f", str(pom)])
        elif gradlew:
            commands.append(["bash", str(gradlew), "dependencies", "--no-daemon"])
            commands.append(["bash", str(gradlew), "build", "-x", "test"])
    if "php" in langs and (target / "composer.json").exists():
        commands.append(["composer", "install", "--no-interaction", "--prefer-dist", "--working-dir", str(target)])
    if "dotnet" in langs:
        commands.append(["dotnet", "restore", str(target)])
        commands.append(["dotnet", "build", str(target)])
    if "ruby" in langs and (target / "Gemfile").exists():
        commands.append(["bundle", "config", "set", "--local", "path", "vendor/bundle"])
        commands.append(["bundle", "config", "set", "--local", "without", "development:test"])
        commands.append(["bundle", "install"])

    errors: list[str] = []
    for command in commands:
        code, out = run(command, cwd=target, dry_run=dry_run)
        if code != 0:
            errors.append(f"{command[0]}: {out}")

    # Post-install verification. These checks do not contact investigation
    # targets; they only validate the local checkout and its dependencies.
    checks: list[list[str]] = [["git", "-C", str(target), "fsck", "--no-progress"]]
    if "python" in langs:
        checks.append([str(repo_venv / "bin" / "pip"), "check"])
    if "node" in langs:
        checks.append(["npm", "ls", "--prefix", str(target), "--depth=0"])
    for check in checks:
        code, out = run(check, cwd=target if check[0] == "git" else None, dry_run=dry_run)
        if code != 0:
            if check[0] == "npm":
                errors.append(f"verification warning {check[0]}: {out}")
            else:
                errors.append(f"verification {check[0]}: {out}")
    detail = ", ".join(sorted(langs)) or "no recognized build files"
    if "node" in langs and not allow_npm_scripts:
        detail += "; npm lifecycle scripts disabled"
    if not commands:
        return Result(display_name, url, "cloned", detail)
    if errors:
        return Result(display_name, url, "partial", " | ".join(errors)[-4000:])
    return Result(display_name, url, "installed", f"verified; {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("github_osint_tools_3_categories.md"))
    parser.add_argument("--directory", type=Path, default=Path("OSINT"))
    parser.add_argument("--yes", action="store_true", help="allow sudo apt-get for missing runtimes")
    parser.add_argument("--no-apt", action="store_true", help="never attempt APT installation")
    parser.add_argument("--skip-kali-packages", action="store_true", help="do not attempt Kali APT tool packages")
    parser.add_argument("--include-dev", action="store_true", help="also install top-level requirements-dev.txt files")
    parser.add_argument("--repo", action="append", help="install only this repository name or owner/name; repeatable")
    parser.add_argument("--with-submodules", action="store_true", help="fetch recursive Git submodules")
    parser.add_argument("--allow-npm-scripts", action="store_true", help="allow npm lifecycle scripts")
    parser.add_argument("--install-kali-apt", action="store_true", help="attempt Kali-only APT package names; off by default")
    parser.add_argument("--dry-run", action="store_true", help="show actions without changing the system")
    args = parser.parse_args()

    if sys.platform != "linux" or not is_debian():
        print("This installer targets Debian/Ubuntu Linux. Run it on the Debian machine.", file=sys.stderr)
        return 2
    if os.geteuid() == 0:
        print("Running as root: APT will run directly without sudo.")
    if args.source.exists() and not args.source.is_file():
        print(f"Source path is not a regular file: {args.source}", file=sys.stderr)
        return 2
    if args.source.is_file():
        try:
            source_text = args.source.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            print(f"Could not read source file {args.source}: {exc}", file=sys.stderr)
            return 2
        repositories = merge_repositories(
            BUILTIN_REPOSITORIES,
            extract_repositories(source_text),
        )
        source_note = f"plus repositories from {args.source}"
    else:
        repositories = merge_repositories(BUILTIN_REPOSITORIES)
        source_note = "using the built-in repository list"
    if args.repo:
        requested = {value.lower().strip("/") for value in args.repo}
        repositories = [
            item for item in repositories
            if item[1].lower() in requested
            or item[0].lower().replace("https://github.com/", "").strip("/") in requested
        ]
        if not repositories:
            print("No repositories matched --repo.", file=sys.stderr)
            return 2
    print(f"Found {len(repositories)} unique concrete repositories; topic/placeholder links were skipped ({source_note}).")
    if not args.dry_run:
        args.directory.mkdir(parents=True, exist_ok=True)
        (args.directory / "repositories").mkdir(parents=True, exist_ok=True)
    if not args.no_apt:
        # Install the common Debian runtimes up front. This avoids creating a
        # venv with a missing interpreter and lets mixed-language repositories
        # build without stopping the whole run.
        if not apt_install(APT_PACKAGES["python"], args.yes, args.dry_run):
            print("APT runtime preparation failed; continuing if git and python3 are already available.", file=sys.stderr)
        if args.install_kali_apt and not args.skip_kali_packages:
            if not apt_install(KALI_APT_TOOLS, args.yes, args.dry_run, update=False):
                print("Some Kali APT tools were unavailable; repository installation will continue.")
    if not args.dry_run:
        missing_core = [command for command in ("git", "python3") if shutil.which(command) is None]
        if missing_core:
            print("Missing required command(s): " + ", ".join(missing_core), file=sys.stderr)
            return 2

    results: list[Result] = []
    interrupted = False
    try:
        for url, name in repositories:
            print(f"\n=== {name} ===")
            results.append(install_repo(url, name, args.directory / "repositories", args.dry_run, args.include_dev, args.with_submodules, args.allow_npm_scripts, args.yes))
            if not args.dry_run:
                report = args.directory / "install-report.json"
                report.write_text(json.dumps([asdict(r) for r in results], indent=2), encoding="utf-8")
    except KeyboardInterrupt:
        interrupted = True
        print("\nInterrupted; partial results were saved.", file=sys.stderr)

    report = args.directory / "install-report.json"
    if not args.dry_run:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps([asdict(r) for r in results], indent=2), encoding="utf-8")
    print("\nSummary:")
    for result in results:
        print(f"[{result.status:9}] {result.name}: {result.detail}")
    if interrupted:
        return 130
    if args.dry_run:
        print("\nNo report written in dry-run mode.")
    else:
        print(f"\nReport: {report}")
    if args.dry_run:
        return 0 if all(r.status == "planned" for r in results) else 1
    return 0 if all(r.status in {"installed", "cloned"} for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
