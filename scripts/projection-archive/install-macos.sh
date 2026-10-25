#!/bin/bash
# Installs the daily projection archiver as a macOS LaunchAgent.
#
#   bash scripts/projection-archive/install-macos.sh            install, then run one capture now
#   bash scripts/projection-archive/install-macos.sh uninstall  remove the scheduled job (keeps the archive)
#
# The script and the archive live outside ~/Documents on purpose: macOS blocks
# background jobs from reading Documents unless you grant Full Disk Access.
set -euo pipefail
LABEL="com.dugoutvalue.projection-archive"
ARCHIVE="${DUGOUT_ARCHIVE:-$HOME/DugoutValueArchive}"
# The scheduled copy lives inside the archive folder so later script updates can be dropped in place.
APP_DIR="$ARCHIVE/bin"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed the scheduled job. The archive at $ARCHIVE was left in place."
  exit 0
fi

PYTHON=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 "$(command -v python3 || true)"; do
  if [[ -n "$candidate" && -x "$candidate" ]] && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 9))' 2>/dev/null; then
    PYTHON="$candidate"; break
  fi
done
[[ -n "$PYTHON" ]] || { echo "Need Python 3.9 or newer." >&2; exit 1; }

mkdir -p "$APP_DIR" "$ARCHIVE/logs" "$HOME/Library/LaunchAgents"
install -m 0644 "$SRC_DIR/archive_projections.py" "$APP_DIR/archive_projections.py"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON</string>
    <string>$APP_DIR/archive_projections.py</string>
    <string>capture</string>
    <string>--archive</string>
    <string>$ARCHIVE</string>
  </array>
  <!-- 6:20 a.m. local time, before any game starts. If the Mac is asleep,
       launchd runs the job when it wakes; the capture records its real time. -->
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>20</integer></dict>
  <key>StandardOutPath</key><string>$ARCHIVE/logs/archive.log</string>
  <key>StandardErrorPath</key><string>$ARCHIVE/logs/archive.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Scheduled daily at 6:20 a.m. using $PYTHON. Archive: $ARCHIVE"
echo "Running the first capture now (about three minutes)..."
"$PYTHON" "$APP_DIR/archive_projections.py" capture --force --archive "$ARCHIVE"
"$PYTHON" "$APP_DIR/archive_projections.py" verify --archive "$ARCHIVE"
