#!/bin/bash
# monitor-cron.sh — Run check-agents.sh and alert Jacques via OpenClaw if needed
# Cron: */5 * * * * /home/iancr/ubtrippin/scripts/monitor-cron.sh

STATUS=$(bash /home/iancr/ubtrippin/scripts/check-agents.sh 2>/dev/null)
ALERTS=$(echo "$STATUS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    alerts = data.get('alerts', [])
    if alerts:
        print('\n'.join(alerts))
    else:
        sys.exit(1)
except:
    sys.exit(1)
" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$ALERTS" ]; then
  openclaw system event --text "Agent monitor: $ALERTS" --mode now 2>/dev/null
fi
