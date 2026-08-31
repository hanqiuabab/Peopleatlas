#!/bin/bash

set -euo pipefail

mode="${1:-template}"
script_dir="$(cd "$(dirname "$0")" && pwd)"
site_dir="${2:-$script_dir/../Docs/PublicSite}"
html_files=("$site_dir/index.html" "$site_dir/privacy.html" "$site_dir/support.html")
placeholders=("__DEVELOPER_NAME__" "__CONTACT_EMAIL__" "__EFFECTIVE_DATE__" "__COPYRIGHT_YEAR__")

for file in "${html_files[@]}" "$site_dir/styles.css"; do
  if [[ ! -s "$file" ]]; then
    echo "Missing or empty public-site file: $file" >&2
    exit 1
  fi
done

for file in "${html_files[@]}"; do
  if grep -Eq '<script|https?://' "$file"; then
    echo "Unexpected script or remote resource in: $file" >&2
    exit 1
  fi
  if ! grep -q '<!doctype html>' "$file" || ! grep -q 'name="viewport"' "$file" || ! grep -q '<main class="shell">' "$file"; then
    echo "Missing required HTML document structure in: $file" >&2
    exit 1
  fi
done

for target in styles.css index.html privacy.html support.html; do
  if [[ ! -s "$site_dir/$target" ]]; then
    echo "Broken local site target: $target" >&2
    exit 1
  fi
done

case "$mode" in
  template)
    for placeholder in "${placeholders[@]}"; do
      if ! grep -Rqs --include='*.html' "$placeholder" "$site_dir"; then
        echo "Template placeholder is missing: $placeholder" >&2
        exit 1
      fi
    done
    echo "Public-site template is complete and has no remote resources."
    ;;
  ready)
    if grep -REn '__[A-Z_]+__' "${html_files[@]}"; then
      echo "Replace every placeholder before publishing." >&2
      exit 1
    fi
    echo "Public-site files are ready for final visual review and HTTPS deployment."
    ;;
  *)
    echo "Usage: $0 [template|ready] [site-directory]" >&2
    exit 2
    ;;
esac
