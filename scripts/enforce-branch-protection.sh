#!/bin/bash
# Enforce strict branch protection for GitHub main branch.

set -euo pipefail

BRANCH="${BRANCH:-main}"
REQUIRED_CHECKS="${REQUIRED_CHECKS:-Quality Gate,Dependency Review}"
GITHUB_API="${GITHUB_API:-https://api.github.com}"

resolve_owner_repo() {
  if [ -n "${OWNER_REPO:-}" ]; then
    printf '%s\n' "$OWNER_REPO"
    return
  fi

  local remote_url
  remote_url="$(git config --get remote.origin.url || true)"
  if [ -z "$remote_url" ]; then
    echo "❌ Could not detect remote.origin.url. Set OWNER_REPO=owner/repo." >&2
    exit 1
  fi

  if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return
  fi

  echo "❌ Could not parse owner/repo from remote URL: $remote_url" >&2
  echo "   Set OWNER_REPO=owner/repo and retry." >&2
  exit 1
}

GITHUB_TOKEN_VALUE="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$GITHUB_TOKEN_VALUE" ]; then
  echo "❌ Missing token. Set GITHUB_TOKEN (or GH_TOKEN) with repo admin permissions." >&2
  exit 1
fi

OWNER_REPO_RESOLVED="$(resolve_owner_repo)"
IFS=',' read -r -a CHECK_CONTEXTS <<< "$REQUIRED_CHECKS"

if [ "${#CHECK_CONTEXTS[@]}" -eq 0 ]; then
  echo "❌ REQUIRED_CHECKS is empty. Provide at least one required status check context." >&2
  exit 1
fi

context_json_entries=()
for context in "${CHECK_CONTEXTS[@]}"; do
  trimmed="$(echo "$context" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [ -n "$trimmed" ]; then
    context_json_entries+=("\"$trimmed\"")
  fi
done

if [ "${#context_json_entries[@]}" -eq 0 ]; then
  echo "❌ REQUIRED_CHECKS only contained empty entries." >&2
  exit 1
fi

CONTEXTS_JSON="$(printf '%s,' "${context_json_entries[@]}")"
CONTEXTS_JSON="[${CONTEXTS_JSON%,}]"

PAYLOAD_PATH="/tmp/ghostreceipt-branch-protection-${BRANCH}.json"
cat > "$PAYLOAD_PATH" <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": $CONTEXTS_JSON
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

echo "🔒 Applying branch protection to ${OWNER_REPO_RESOLVED}:${BRANCH}"
http_code="$(
  curl -sS -o /tmp/ghostreceipt-branch-protection-response.json -w '%{http_code}' -X PUT \
    -H "Authorization: Bearer $GITHUB_TOKEN_VALUE" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${GITHUB_API}/repos/${OWNER_REPO_RESOLVED}/branches/${BRANCH}/protection" \
    -d @"$PAYLOAD_PATH"
)"

if [ "$http_code" != "200" ]; then
  echo "❌ Failed to apply branch protection (HTTP $http_code)." >&2
  cat /tmp/ghostreceipt-branch-protection-response.json >&2
  exit 1
fi

echo "✅ Branch protection updated."
echo "📋 Required checks:"
node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync('/tmp/ghostreceipt-branch-protection-response.json','utf8'));for(const c of (r.required_status_checks?.contexts||[])){console.log('   - '+c);}console.log('🧱 Admin enforcement: '+(r.enforce_admins?.enabled?'on':'off'));console.log('🧾 PR approvals required: '+(r.required_pull_request_reviews?.required_approving_review_count??0));console.log('💬 Conversation resolution: '+(r.required_conversation_resolution?.enabled?'on':'off'));console.log('📚 Linear history: '+(r.required_linear_history?.enabled?'on':'off'));"
