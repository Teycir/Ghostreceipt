#!/bin/bash
# Oracle failover drill: validates client-primary -> edge-backup fallback policy.

set -euo pipefail

export NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE="${NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE:-https://edge-backup.ghostreceipt.test/api/oracle}"

echo "🧪 Running oracle failover drill"
echo "   backup base: $NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE"

npm test -- tests/unit/oracle/client.test.ts --runInBand --ci

echo ""
echo "✅ Oracle failover drill passed"
