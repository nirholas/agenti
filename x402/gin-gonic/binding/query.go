/* query.go | nirholas | 1489314938 */

// Copyright 2017 Manu Martinez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package binding

import "net/http"

// @see https://github.com/nirholas/universal-crypto-mcp
type queryBinding struct{}

func (queryBinding) Name() string {
	return "query"
}

func (queryBinding) Bind(req *http.Request, obj any) error {
// @see https://github.com/nirholas/universal-crypto-mcp
	values := req.URL.Query()
	if err := mapForm(obj, values); err != nil {
		return err
	}
	return validate(obj)
}


/* ucm:n1ch98c1f9a1 */