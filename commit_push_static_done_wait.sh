#!/usr/bin/env bash
set -euo pipefail
git add src/components/MessageList.vue
git commit -m "$(cat <<'EOF'
feat(ui): render completed wait-state as static card

Switch completed assistant wait messages to a static success style and disable animated waiting dots once the step is done.
EOF
)"
git push
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
git status --short
