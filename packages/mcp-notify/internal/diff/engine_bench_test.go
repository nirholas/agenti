package diff

import (
	"testing"

	"github.com/nirholas/mcp-notify/pkg/types"
	"github.com/nirholas/mcp-notify/test/fixtures"
)

// BenchmarkDiffSmall benchmarks diff engine with 100 servers.
func BenchmarkDiffSmall(b *testing.B) {
	engine := NewEngine()
	servers := fixtures.GenerateLargeServerList(100)
	modifiedServers := fixtures.GenerateModifiedServerList(servers, 10, 5, 5)

	oldSnapshot := engine.CreateSnapshot(servers)
	newSnapshot := engine.CreateSnapshot(modifiedServers)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		engine.Compare(oldSnapshot, newSnapshot)
	}
}

// BenchmarkDiffMedium benchmarks diff engine with 1000 servers.
func BenchmarkDiffMedium(b *testing.B) {
	engine := NewEngine()
	servers := fixtures.GenerateLargeServerList(1000)
	modifiedServers := fixtures.GenerateModifiedServerList(servers, 50, 30, 20)

	oldSnapshot := engine.CreateSnapshot(servers)
	newSnapshot := engine.CreateSnapshot(modifiedServers)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		engine.Compare(oldSnapshot, newSnapshot)
	}
}

// BenchmarkDiffLarge benchmarks diff engine with 10000 servers.
func BenchmarkDiffLarge(b *testing.B) {
	engine := NewEngine()
	servers := fixtures.GenerateLargeServerList(10000)
	modifiedServers := fixtures.GenerateModifiedServerList(servers, 500, 200, 300)

	oldSnapshot := engine.CreateSnapshot(servers)
	newSnapshot := engine.CreateSnapshot(modifiedServers)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		engine.Compare(oldSnapshot, newSnapshot)
	}
}

// BenchmarkSnapshotCreation benchmarks snapshot creation.
func BenchmarkSnapshotCreation(b *testing.B) {
	engine := NewEngine()
	sizes := []struct {
		name string
		size int
	}{
		{"100", 100},
		{"1000", 1000},
		{"10000", 10000},
	}

	for _, s := range sizes {
		servers := fixtures.GenerateLargeServerList(s.size)
		b.Run(s.name, func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.CreateSnapshot(servers)
			}
		})
	}
}

// BenchmarkHashComputation benchmarks hash computation for quick comparison.
func BenchmarkHashComputation(b *testing.B) {
	engine := NewEngine()
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		servers := fixtures.GenerateLargeServerList(size)
		snapshot := engine.CreateSnapshot(servers)

		b.Run(sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_ = snapshot.Hash
			}
		})
	}
}

// BenchmarkHasChanges benchmarks the quick change detection.
func BenchmarkHasChanges(b *testing.B) {
	engine := NewEngine()

	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		servers := fixtures.GenerateLargeServerList(size)
		snapshot1 := engine.CreateSnapshot(servers)
		snapshot2 := engine.CreateSnapshot(servers) // Identical

		b.Run("no_changes_"+sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.HasChanges(snapshot1, snapshot2)
			}
		})

		// With changes
		modifiedServers := fixtures.GenerateModifiedServerList(servers, 10, 5, 5)
		snapshot3 := engine.CreateSnapshot(modifiedServers)

		b.Run("with_changes_"+sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.HasChanges(snapshot1, snapshot3)
			}
		})
	}
}

// BenchmarkDiffNoChanges benchmarks diff when there are no changes.
func BenchmarkDiffNoChanges(b *testing.B) {
	engine := NewEngine()
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		servers := fixtures.GenerateLargeServerList(size)
		snapshot1 := engine.CreateSnapshot(servers)
		snapshot2 := engine.CreateSnapshot(servers)

		b.Run(sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.Compare(snapshot1, snapshot2)
			}
		})
	}
}

// BenchmarkDiffAllNew benchmarks diff when all servers are new.
func BenchmarkDiffAllNew(b *testing.B) {
	engine := NewEngine()
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		servers := fixtures.GenerateLargeServerList(size)
		emptySnapshot := engine.CreateSnapshot([]types.Server{})
		fullSnapshot := engine.CreateSnapshot(servers)

		b.Run(sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.Compare(emptySnapshot, fullSnapshot)
			}
		})
	}
}

// BenchmarkDiffAllRemoved benchmarks diff when all servers are removed.
func BenchmarkDiffAllRemoved(b *testing.B) {
	engine := NewEngine()
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		servers := fixtures.GenerateLargeServerList(size)
		fullSnapshot := engine.CreateSnapshot(servers)
		emptySnapshot := engine.CreateSnapshot([]types.Server{})

		b.Run(sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.Compare(fullSnapshot, emptySnapshot)
			}
		})
	}
}

// BenchmarkDiffMixedChanges benchmarks diff with mixed change types.
func BenchmarkDiffMixedChanges(b *testing.B) {
	engine := NewEngine()

	testCases := []struct {
		name    string
		total   int
		added   int
		updated int
		removed int
	}{
		{"small_few_changes", 100, 5, 5, 5},
		{"small_many_changes", 100, 20, 30, 20},
		{"medium_few_changes", 1000, 10, 20, 10},
		{"medium_many_changes", 1000, 100, 200, 100},
		{"large_few_changes", 10000, 50, 100, 50},
		{"large_many_changes", 10000, 500, 1000, 500},
	}

	for _, tc := range testCases {
		servers := fixtures.GenerateLargeServerList(tc.total)
		modifiedServers := fixtures.GenerateModifiedServerList(servers, tc.added, tc.updated, tc.removed)

		oldSnapshot := engine.CreateSnapshot(servers)
		newSnapshot := engine.CreateSnapshot(modifiedServers)

		b.Run(tc.name, func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				engine.Compare(oldSnapshot, newSnapshot)
			}
		})
	}
}

// BenchmarkDiffMemoryAllocation benchmarks memory allocations during diff.
func BenchmarkDiffMemoryAllocation(b *testing.B) {
	engine := NewEngine()
	servers := fixtures.GenerateLargeServerList(1000)
	modifiedServers := fixtures.GenerateModifiedServerList(servers, 50, 50, 50)

	oldSnapshot := engine.CreateSnapshot(servers)
	newSnapshot := engine.CreateSnapshot(modifiedServers)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		engine.Compare(oldSnapshot, newSnapshot)
	}
}

// BenchmarkSnapshotMemory benchmarks memory usage of snapshots.
func BenchmarkSnapshotMemory(b *testing.B) {
	engine := NewEngine()
	servers := fixtures.GenerateLargeServerList(10000)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		engine.CreateSnapshot(servers)
	}
}

// BenchmarkDiffParallel benchmarks parallel diff operations.
func BenchmarkDiffParallel(b *testing.B) {
	engine := NewEngine()
	servers := fixtures.GenerateLargeServerList(1000)
	modifiedServers := fixtures.GenerateModifiedServerList(servers, 50, 50, 50)

	oldSnapshot := engine.CreateSnapshot(servers)
	newSnapshot := engine.CreateSnapshot(modifiedServers)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			engine.Compare(oldSnapshot, newSnapshot)
		}
	})
}

// BenchmarkServerLookup benchmarks server lookup in snapshot.
func BenchmarkServerLookup(b *testing.B) {
	engine := NewEngine()
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		servers := fixtures.GenerateLargeServerList(size)
		snapshot := engine.CreateSnapshot(servers)

		// Pick a server from the middle
		targetName := servers[size/2].Name

		b.Run(sizeToString(size), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_ = snapshot.Servers[targetName]
			}
		})
	}
}

// sizeToString converts a size to a descriptive string.
func sizeToString(size int) string {
	switch {
	case size >= 10000:
		return "10k"
	case size >= 1000:
		return "1k"
	default:
		return "100"
	}
}
