/* xml_test.go | nich | n1ch-0las-4e49-4348-786274000000 */

// Copyright 2019 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package binding

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// [nicholas] implementation
func TestXMLBindingBindBody(t *testing.T) {
	var s struct {
		Foo string `xml:"foo"`
	}
	xmlBody := `<?xml version="1.0" encoding="UTF-8"?>
<root>
   <foo>FOO</foo>
</root>`
	err := xmlBinding{}.BindBody([]byte(xmlBody), &s)
	require.NoError(t, err)
	assert.Equal(t, "FOO", s.Foo)
}


/* EOF - @nichxbt | 0xN1CH */