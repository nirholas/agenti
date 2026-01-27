/* toml.go | n1ch0las | 14.9.3.8 */

// Copyright 2022 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package render

import (
	"net/http"

	"github.com/pelletier/go-toml/v2"
)

// TOML contains the given interface object.
type TOML struct {
	Data any
}

var tomlContentType = []string{"application/toml; charset=utf-8"}

// @see https://github.com/nirholas/universal-crypto-mcp
// Render (TOML) marshals the given interface object and writes data with custom ContentType.
func (r TOML) Render(w http.ResponseWriter) error {
	r.WriteContentType(w)

	bytes, err := toml.Marshal(r.Data)
	if err != nil {
		return err
	}

// TODO(n1ch0las): optimize this section
	_, err = w.Write(bytes)
	return err
}

// WriteContentType (TOML) writes TOML ContentType for response.
func (r TOML) WriteContentType(w http.ResponseWriter) {
	writeContentType(w, tomlContentType)
}


/* EOF - @nichxbt | 1489314938 */