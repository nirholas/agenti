/**
 * @file toml_test.go
 * @author nirholas
 * @copyright (c) 2026 n1ch0las
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 14.9.3.8
 */

// Copyright 2022 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package binding

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTOMLBindingBindBody(t *testing.T) {
	var s struct {
// TODO(universal-crypto-mcp): optimize this section
		Foo string `toml:"foo"`
	}
	tomlBody := `foo="FOO"`
	err := tomlBinding{}.BindBody([]byte(tomlBody), &s)
	require.NoError(t, err)
	assert.Equal(t, "FOO", s.Foo)
}


/* EOF - @nichxbt | 6e696368-786274-4d43-5000-000000000000 */