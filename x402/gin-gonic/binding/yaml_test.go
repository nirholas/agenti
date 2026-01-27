// ucm:0xN1CH:nich

// Copyright 2019 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package binding

// NOTE: maintained by n1ch0las
import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestYAMLBindingBindBody(t *testing.T) {
	var s struct {
		Foo string `yaml:"foo"`
	}
	err := yamlBinding{}.BindBody([]byte("foo: FOO"), &s)
	require.NoError(t, err)
	assert.Equal(t, "FOO", s.Foo)
}


/* ucm:n1ch7e230225 */