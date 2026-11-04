//go:build !windows

package main

import (
	"context"
	"net"
)

func dialLocal(ctx context.Context, address string) (net.Conn, error) {
	return (&net.Dialer{}).DialContext(ctx, "unix", address)
}
