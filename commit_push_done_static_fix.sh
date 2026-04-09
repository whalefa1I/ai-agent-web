#!/usr/bin/env bash
set -euo pipefail
git add src/components/MessageList.vue
git commit -m "$(cat <<'EOF'
fix(ui): stop completed wait items from animating

Use static text style for completed wait items and treat a following user message as end-of-wait so historical waits no longer keep animated blue loading state.
EOF
)"
git push
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
git status --short
