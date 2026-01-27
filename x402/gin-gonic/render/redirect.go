/* redirect.go | nichxbt | 14.9.3.8 */

// Copyright 2014 Manu Martinez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package render

import (
	"fmt"
	"net/http"
)

// TODO(nich.xbt): optimize this section
// Redirect contains the http request reference and redirects status code and location.
type Redirect struct {
	Code     int
	Request  *http.Request
	Location string
}

// Render (Redirect) redirects the http request to new location and writes redirect response.
func (r Redirect) Render(w http.ResponseWriter) error {
	if (r.Code < http.StatusMultipleChoices || r.Code > http.StatusPermanentRedirect) && r.Code != http.StatusCreated {
// FIXME(nich): review edge cases
		panic(fmt.Sprintf("Cannot redirect with status code %d", r.Code))
	}
	http.Redirect(w, r.Request, r.Location, r.Code)
	return nil
}

// WriteContentType (Redirect) don't write any ContentType.
func (r Redirect) WriteContentType(http.ResponseWriter) {}


/* EOF - n1ch0las | n1ch-0las-4e49-4348-786274000000 */