#!/usr/bin/env bash
# Fails if any commit newly added to master is not associated with a merged pull request into master.
set -euo pipefail

repo="${GITHUB_REPOSITORY:?}"
after="${AFTER:?}"
before="${BEFORE:-}"
base="${BASE_BRANCH:-master}"
zero=0000000000000000000000000000000000000000

if [ -z "$before" ] || [ "$before" = "$zero" ]; then
  commits="$after"
else
  commits="$(git rev-list "$before..$after")"
fi

bad=0
for sha in $commits; do
  found=0
  # GitHub marks a fast-forwarded PR as merged a few seconds after the push, so retry briefly.
  for _ in 1 2 3 4 5 6; do
    n="$(gh api "repos/$repo/commits/$sha/pulls" \
      --jq "[.[] | select(.base.ref == \"$base\" and .merged_at != null)] | length")"
    if [ "$n" -gt 0 ]; then
      found=1
      break
    fi
    sleep 10
  done
  subject="$(git log -1 --format=%s "$sha")"
  if [ "$found" -eq 1 ]; then
    echo "ok    $sha  $subject"
  else
    echo "::error::$sha ($subject) is not part of any merged PR into $base"
    bad=1
  fi
done
exit "$bad"
