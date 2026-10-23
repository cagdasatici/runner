#!/bin/bash
# Installs (or reinstalls) the LaunchAgent that serves the game over HTTPS at login and keeps it running.
# Run from web/ after `npm run deploy` and after the certificate exists (Task W7).
set -euo pipefail
LABEL="${SUBWAY_RUNNER_LABEL:-com.cagdasatici.subwayrunner}"     # overrides only for testing
SITE="${SUBWAY_RUNNER_SITE:-$HOME/Library/Application Support/SubwayRunner}"
PLIST="${SUBWAY_RUNNER_PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
PORT=8843
LOGS="$HOME/Library/Logs/SubwayRunner"
NODE=/opt/homebrew/bin/node

for f in "$NODE" "$SITE/serve-https.mjs" "$SITE/www/index.html" "$SITE/certs/cert.pem" "$SITE/certs/key.pem"; do
  [ -e "$f" ] || { echo "Missing: $f"; exit 1; }
done
mkdir -p "$LOGS" "$(dirname "$PLIST")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$SITE/serve-https.mjs</string>
    <string>--dir</string><string>$SITE/www</string>
    <string>--cert</string><string>$SITE/certs/cert.pem</string>
    <string>--key</string><string>$SITE/certs/key.pem</string>
    <string>--port</string><string>$PORT</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGS/server.log</string>
  <key>StandardErrorPath</key><string>$LOGS/server.log</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true    # replace an older copy
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 1
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state =|pid =" | head -2
echo "Installed $LABEL. Logs: $LOGS/server.log"
