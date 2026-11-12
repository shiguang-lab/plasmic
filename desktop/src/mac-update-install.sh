#!/bin/sh
# Runs outside the application bundle so it can replace the application.
set -eu
pid=$1
target=$2
staged=$3
backup=$4
receipt=$5
transaction=$6
failure=$7
log=$8
pidfile=$9
mode=${10}
exec >>"$log" 2>&1
launch() {
  if [ -n "${PLASMIC_DESKTOP_PROFILE:-}" ]; then
    /usr/bin/open -n --env "PLASMIC_DESKTOP_PROFILE=$PLASMIC_DESKTOP_PROFILE" "$target"
  else
    /usr/bin/open -n "$target"
  fi
}
rollback() {
  echo 'New version failed to start; previous version restored' >"$failure"
  if [ -d "$backup" ]; then
    rm -rf "$target"
    mv "$backup" "$target"
  fi
  rm -rf "$staged"
  rm -f "$receipt" "$transaction" "$pidfile"
  if [ "$mode" != apply ]; then launch || true; fi
  exit 1
}
if [ "$mode" = restart ]; then
  i=0
  while kill -0 "$pid" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo 'Application did not quit; installation cancelled' >"$failure"
      exit 1
    fi
    sleep 1
  done
fi
if [ "$mode" != verify ]; then
  if ! mv "$target" "$backup"; then
    echo 'Cannot move installed application' >"$failure"
    rm -rf "$staged"
    rm -f "$transaction"
    exit 1
  fi
  mv "$staged" "$target" || rollback
  if [ "$mode" = apply ]; then exit 0; fi
  launch || rollback
fi
i=0
while [ ! -f "$receipt" ]; do
  i=$((i + 1))
  if [ "$i" -ge 90 ]; then
    if [ -f "$pidfile" ]; then
      newpid=$(cat "$pidfile")
      command=$(/bin/ps -p "$newpid" -o comm= || true)
      if [ "$command" = "$target/Contents/MacOS/Plasmic" ]; then kill "$newpid" || true; fi
    fi
    sleep 2
    rollback
  fi
  sleep 1
done
rm -rf "$backup"
rm -f "$receipt" "$transaction" "$failure" "$pidfile"
