#!/bin/sh
# Unpolish installer — works in any web project, no package manager needed.
#
#   curl -fsSL <site>/unpolish/install.sh | sh -s -- <site>/unpolish/
#
# Run it from your project folder. It copies Unpolish into your static assets
# folder and adds one <script> tag to your HTML entry. Options:
#
#   --dir <path>   static assets folder (default: public/, static/, else the project root)
#   --no-tag       copy the files only; print the tag to add yourself
#   --uninstall    remove the script tag(s) and the unpolish/ folder
#
# Re-running updates unpolish.js and never overwrites your unpolish.config.json.

set -eu

SRC=""
DIR=""
TAG=1
UNINSTALL=0
MARK='unpolish/unpolish.js'

say() { printf '%s\n' "$*"; }
ok() { printf '  \342\234\223 %s\n' "$*"; }
fail() { printf 'unpolish: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) [ $# -ge 2 ] || fail "--dir needs a path"; DIR=$2; shift ;;
    --dir=*) DIR=${1#*=} ;;
    --no-tag) TAG=0 ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help) sed -n '2,14p' "$0" 2>/dev/null || true; exit 0 ;;
    http://*|https://*|file://*) SRC=$1 ;;
    *) fail "unknown option: $1" ;;
  esac
  shift
done

# Where static files are served from.
if [ -z "$DIR" ]; then
  if [ -d public ]; then DIR=public
  elif [ -d static ]; then DIR=static
  else DIR=.
  fi
fi
DIR=${DIR%/}
DEST="$DIR/unpolish"

# HTML entry points we can edit safely, by convention.
entries() {
  if [ "$DIR" = "." ]; then
    # Plain site: every top-level page.
    for f in ./*.html; do [ -f "$f" ] && printf '%s\n' "${f#./}"; done
    return
  fi
  for f in index.html src/app.html public/index.html src/index.html; do
    [ -f "$f" ] && { printf '%s\n' "$f"; return; }
  done
  return 0
}

if [ "$UNINSTALL" -eq 1 ]; then
  say "Removing Unpolish"
  for f in $(entries) ; do
    if grep -q "$MARK" "$f"; then
      grep -v "$MARK" "$f" > "$f.unpolish-tmp" && mv "$f.unpolish-tmp" "$f"
      ok "removed the script tag from $f"
    fi
  done
  if [ -d "$DEST" ]; then rm -rf "$DEST"; ok "deleted $DEST/"; fi
  say "Done. Anything you added by hand (for example in a Next.js layout) still needs removing."
  exit 0
fi

[ -n "$SRC" ] || fail "pass the address the files are served from, e.g. sh -s -- https://example.com/unpolish/"
case "$SRC" in */) ;; *) SRC="$SRC/" ;; esac

fetch() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
  else fail "needs curl or wget"
  fi
}

say "Installing Unpolish into $DEST/"
mkdir -p "$DEST"
fetch "${SRC}unpolish.js" "$DEST/unpolish.js" || fail "could not download ${SRC}unpolish.js"
ok "unpolish.js"
fetch "${SRC}unpolish.config.schema.json" "$DEST/unpolish.config.schema.json" && ok "unpolish.config.schema.json"
fetch "${SRC}README.md" "$DEST/README.md" && ok "README.md (integration and removal guide)"
if [ -f "$DEST/unpolish.config.json" ]; then
  ok "kept your existing unpolish.config.json"
else
  fetch "${SRC}unpolish.config.json" "$DEST/unpolish.config.json" && ok "unpolish.config.json"
fi

# Script path as the browser sees it.
if [ "$DIR" = "." ]; then URL="unpolish/unpolish.js"; else URL="/unpolish/unpolish.js"; fi
LINE="<script src=\"$URL\" data-config=\"unpolish.config.json\" defer></script>"

added=0
if [ "$TAG" -eq 1 ]; then
  for f in $(entries); do
    if grep -q "$MARK" "$f"; then ok "$f already loads Unpolish"; added=1; continue; fi
    if grep -qi '</head>' "$f"; then
      # Insert before the first </head>, indented one step deeper than it.
      awk -v line="$LINE" 'BEGIN{d=0} { if (!d && tolower($0) ~ /<\/head>/) { match($0, /^[ \t]*/); print substr($0, 1, RLENGTH) "  " line; d=1 } print }' "$f" > "$f.unpolish-tmp" && mv "$f.unpolish-tmp" "$f"
      ok "added the script tag to $f"
      added=1
    fi
  done
fi

if [ "$added" -eq 0 ]; then
  say ""
  next=0
  for f in app/layout.* src/app/layout.* pages/_app.* src/pages/_app.*; do [ -f "$f" ] && next=1; done
  if [ "$next" -eq 1 ]; then
    say "Next.js: add this inside <body> in your root layout (app/layout or pages/_app):"
    say "  import Script from 'next/script';"
    say "  <Script src=\"$URL\" data-config=\"unpolish.config.json\" strategy=\"afterInteractive\" />"
  else
    say "Add this line to the <head> of your HTML entry or root layout:"
    say "  $LINE"
  fi
fi

say ""
say "Next: open your prototype and press \\ to pick a theme."
say "Remove later with the same command plus --uninstall."
