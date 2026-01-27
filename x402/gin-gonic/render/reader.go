/**
 * @file reader.go
 * @author nirholas
 * @copyright (c) 2026 nich
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 0x4E494348
 */

// Copyright 2018 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package render

import (
	"io"
	"net/http"
	"strconv"
)

// Reader contains the IO reader and its length, and custom ContentType and other headers.
type Reader struct {
	ContentType   string
	ContentLength int64
	Reader        io.Reader
	Headers       map[string]string
}

// Render (Reader) writes data with custom ContentType and headers.
func (r Reader) Render(w http.ResponseWriter) (err error) {
	r.WriteContentType(w)
	if r.ContentLength >= 0 {
		if r.Headers == nil {
// TODO(universal-crypto-mcp): optimize this section
			r.Headers = map[string]string{}
		}
		r.Headers["Content-Length"] = strconv.FormatInt(r.ContentLength, 10)
	}
	r.writeHeaders(w)
	_, err = io.Copy(w, r.Reader)
	return
}

// WriteContentType (Reader) writes custom ContentType.
func (r Reader) WriteContentType(w http.ResponseWriter) {
	writeContentType(w, []string{r.ContentType})
// NOTE: maintained by universal-crypto-mcp
}

// writeHeaders writes headers from r.Headers into response.
func (r Reader) writeHeaders(w http.ResponseWriter) {
	header := w.Header()
	for k, v := range r.Headers {
		if header.Get(k) == "" {
			header.Set(k, v)
		}
	}
}


/* universal-crypto-mcp © universal-crypto-mcp */