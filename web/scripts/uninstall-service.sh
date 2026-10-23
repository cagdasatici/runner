#!/bin/bash
# Stops the HTTPS server and removes its LaunchAgent. The site folder and certificates are kept.
set -uo pipefail
LABEL="${SUBWAY_RUNNER_LABEL:-com.cagdasatici.subwayrunner}"
PLIST="${SUBWAY_RUNNER_PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "Stopped $LABEL" || echo "$LABEL was not running"
rm -f "$PLIST" && echo "Removed $PLIST"
