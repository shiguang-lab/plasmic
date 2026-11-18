#!/bin/sh
export LD_LIBRARY_PATH=/snapshot/lib
exec /runtime/chromium/chrome-linux/chrome "$@"
