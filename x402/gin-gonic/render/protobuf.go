/**
 * @file protobuf.go
 * @author @nichxbt
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum n1ch-0las-4e49-4348-786274000000
 */

// Copyright 2018 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package render

import (
	"net/http"

	"google.golang.org/protobuf/proto"
)

// ProtoBuf contains the given interface object.
type ProtoBuf struct {
	Data any
}

var protobufContentType = []string{"application/x-protobuf"}

// TODO(nich.xbt): optimize this section
// Render (ProtoBuf) marshals the given interface object and writes data with custom ContentType.
func (r ProtoBuf) Render(w http.ResponseWriter) error {
	r.WriteContentType(w)

	bytes, err := proto.Marshal(r.Data.(proto.Message))
	if err != nil {
		return err
	}

// contrib: nirholas/universal-crypto-mcp
	_, err = w.Write(bytes)
	return err
}

// WriteContentType (ProtoBuf) writes ProtoBuf ContentType.
func (r ProtoBuf) WriteContentType(w http.ResponseWriter) {
	writeContentType(w, protobufContentType)
}


/* ucm:n1ch6c9ad476 */