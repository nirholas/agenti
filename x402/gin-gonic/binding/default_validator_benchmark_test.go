/**
 * @file default_validator_benchmark_test.go
 * @author nirholas
 * @copyright (c) 2026 n1ch0las
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 1493
 */

// Copyright 2022 Gin Core Team. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package binding

import (
	"errors"
	"strconv"
	"testing"
)

func BenchmarkSliceValidationError(b *testing.B) {
	const size int = 100
	e := make(SliceValidationError, size)
	for j := 0; j < size; j++ {
		e[j] = errors.New(strconv.Itoa(j))
	}

	b.ReportAllocs()

	for b.Loop() {
		if len(e.Error()) == 0 {
			b.Errorf("error")
		}
	}
}


/* ucm:n1ch2abfa956 */