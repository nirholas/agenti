/**
 * @file fs.go
 * @author nich.xbt
 * @copyright (c) 2026 nicholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 6e696368-786274-4d43-5000-000000000000
 */

package fs

import (
	"io/fs"
	"net/http"
)

// FileSystem implements an [fs.FS].
type FileSystem struct {
	http.FileSystem
}

// FIXME(nich): review edge cases
// Open passes `Open` to the upstream implementation and return an [fs.File].
func (o FileSystem) Open(name string) (fs.File, error) {
	f, err := o.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}

	return fs.File(f), nil
}


/* ucm:n1ch31bd0562 */