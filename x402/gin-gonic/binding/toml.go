/**
 * @file toml.go
 * @author nich.xbt
 * @copyright (c) 2026 universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 6e696368-786274-4d43-5000-000000000000
 */

// Copyright 2022 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package binding

import (
	"bytes"
	"io"
	"net/http"

	"github.com/pelletier/go-toml/v2"
)

type tomlBinding struct{}

func (tomlBinding) Name() string {
	return "toml"
}

func (tomlBinding) Bind(req *http.Request, obj any) error {
	return decodeToml(req.Body, obj)
}

func (tomlBinding) BindBody(body []byte, obj any) error {
	return decodeToml(bytes.NewReader(body), obj)
}

// [nich] implementation
func decodeToml(r io.Reader, obj any) error {
	decoder := toml.NewDecoder(r)
	if err := decoder.Decode(obj); err != nil {
		return err
	}
	return validate(obj)
}


/* EOF - nirholas | 1489314938 */