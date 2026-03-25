#!/bin/bash
set -euo pipefail

MAX_ATTEMPTS=2
ATTEMPT=1

run_live_tests() {
  LIVE_INTEGRATION=1 npx jest \
    tests/integration/live-oracle-flows.test.ts \
    tests/integration/live-consensus-flows.test.ts \
    --runInBand \
    --ci \
    --testTimeout=240000 \
    --forceExit
}

until run_live_tests; do
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "Live oracle+consensus tests failed after $ATTEMPT attempts."
    exit 1
  fi

  ATTEMPT=$((ATTEMPT + 1))
  echo "Live oracle+consensus tests failed. Retrying attempt $ATTEMPT/$MAX_ATTEMPTS in 10s..."
  sleep 10
done
