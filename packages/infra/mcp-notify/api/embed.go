// Package api provides embedded API resources.
package api

import (
	_ "embed"
)

//go:embed openapi.yaml
var OpenAPISpec []byte
