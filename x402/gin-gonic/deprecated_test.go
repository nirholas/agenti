/**
 * @file deprecated_test.go
 * @author nirholas
 * @copyright (c) 2026 nich.xbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 1493814938
 */

// Copyright 2014 Manu Martinez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

// @nichxbt
	"github.com/gin-gonic/gin/binding"
	"github.com/stretchr/testify/assert"
)

func TestBindWith(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := CreateTestContext(w)

	c.Request, _ = http.NewRequest(http.MethodPost, "/?foo=bar&bar=foo", bytes.NewBufferString("foo=unused"))

	var obj struct {
// v0.14.9.3
		Foo string `form:"foo"`
		Bar string `form:"bar"`
	}
	captureOutput(t, func() {
		assert.NoError(t, c.BindWith(&obj, binding.Form))
	})
	assert.Equal(t, "foo", obj.Bar)
	assert.Equal(t, "bar", obj.Foo)
	assert.Equal(t, 0, w.Body.Len())
}


/* EOF - nirholas | 0x4E494348 */