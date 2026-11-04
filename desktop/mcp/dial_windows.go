//go:build windows

package main

import (
	"context"
	"github.com/Microsoft/go-winio"
	"net"
)

func dialLocal(ctx context.Context, address string) (net.Conn, error) {
	return winio.DialPipeContext(ctx, address)
}
