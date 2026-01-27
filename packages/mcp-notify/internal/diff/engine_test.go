// Package diff provides change detection between registry snapshots.
package diff

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nirholas/mcp-notify/pkg/types"
)

func TestEngine_CreateSnapshot(t *testing.T) {
	engine := NewEngine()

	servers := []types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
		{Name: "server3", Description: "Server 3"},
	}

	snapshot := engine.CreateSnapshot(servers)

	assert.NotEqual(t, uuid.Nil, snapshot.ID)
	assert.Equal(t, 3, snapshot.ServerCount)
	assert.NotEmpty(t, snapshot.Hash)
	assert.WithinDuration(t, time.Now(), snapshot.Timestamp, time.Second)

	// Verify servers are properly mapped
	assert.Len(t, snapshot.Servers, 3)
	assert.Equal(t, "Server 1", snapshot.Servers["server1"].Description)
	assert.Equal(t, "Server 2", snapshot.Servers["server2"].Description)
	assert.Equal(t, "Server 3", snapshot.Servers["server3"].Description)
}

func TestEngine_CreateSnapshot_Empty(t *testing.T) {
	engine := NewEngine()

	snapshot := engine.CreateSnapshot([]types.Server{})

	assert.NotEqual(t, uuid.Nil, snapshot.ID)
	assert.Equal(t, 0, snapshot.ServerCount)
	assert.NotEmpty(t, snapshot.Hash)
	assert.Empty(t, snapshot.Servers)
}

func TestEngine_Compare_BothNil(t *testing.T) {
	engine := NewEngine()

	result := engine.Compare(nil, nil)

	assert.NotNil(t, result)
	assert.Empty(t, result.NewServers)
	assert.Empty(t, result.UpdatedServers)
	assert.Empty(t, result.RemovedServers)
	assert.Equal(t, 0, result.TotalChanges)
}

func TestEngine_Compare_FromNil(t *testing.T) {
	engine := NewEngine()

	to := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
	})

	result := engine.Compare(nil, to)

	assert.Len(t, result.NewServers, 2)
	assert.Empty(t, result.UpdatedServers)
	assert.Empty(t, result.RemovedServers)
	assert.Equal(t, 2, result.TotalChanges)
}

func TestEngine_Compare_ToNil(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
	})

	result := engine.Compare(from, nil)

	assert.Empty(t, result.NewServers)
	assert.Empty(t, result.UpdatedServers)
	assert.Empty(t, result.RemovedServers)
	assert.Equal(t, 0, result.TotalChanges)
}

func TestEngine_Compare_NewServers(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
	})

	to := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
		{Name: "server3", Description: "Server 3"},
	})

	result := engine.Compare(from, to)

	assert.Len(t, result.NewServers, 2)
	assert.Empty(t, result.UpdatedServers)
	assert.Empty(t, result.RemovedServers)
	assert.Equal(t, 2, result.TotalChanges)

	// Verify change details
	newServerNames := make([]string, len(result.NewServers))
	for i, c := range result.NewServers {
		newServerNames[i] = c.ServerName
		assert.Equal(t, types.ChangeTypeNew, c.ChangeType)
		assert.NotNil(t, c.Server)
	}
	assert.Contains(t, newServerNames, "server2")
	assert.Contains(t, newServerNames, "server3")
}

func TestEngine_Compare_RemovedServers(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
		{Name: "server3", Description: "Server 3"},
	})

	to := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
	})

	result := engine.Compare(from, to)

	assert.Empty(t, result.NewServers)
	assert.Empty(t, result.UpdatedServers)
	assert.Len(t, result.RemovedServers, 2)
	assert.Equal(t, 2, result.TotalChanges)

	// Verify change details
	removedServerNames := make([]string, len(result.RemovedServers))
	for i, c := range result.RemovedServers {
		removedServerNames[i] = c.ServerName
		assert.Equal(t, types.ChangeTypeRemoved, c.ChangeType)
		assert.NotNil(t, c.PreviousServer)
	}
	assert.Contains(t, removedServerNames, "server2")
	assert.Contains(t, removedServerNames, "server3")
}

func TestEngine_Compare_UpdatedServers(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Old description"},
	})

	to := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "New description"},
	})

	result := engine.Compare(from, to)

	assert.Empty(t, result.NewServers)
	assert.Len(t, result.UpdatedServers, 1)
	assert.Empty(t, result.RemovedServers)
	assert.Equal(t, 1, result.TotalChanges)

	// Verify change details
	change := result.UpdatedServers[0]
	assert.Equal(t, "server1", change.ServerName)
	assert.Equal(t, types.ChangeTypeUpdated, change.ChangeType)
	assert.NotNil(t, change.Server)
	assert.NotNil(t, change.PreviousServer)

	// Verify field changes
	require.Len(t, change.FieldChanges, 1)
	assert.Equal(t, "description", change.FieldChanges[0].Field)
	assert.Equal(t, "Old description", change.FieldChanges[0].OldValue)
	assert.Equal(t, "New description", change.FieldChanges[0].NewValue)
}

func TestEngine_Compare_VersionChange(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			VersionDetail: &types.VersionDetail{
				Version:  "1.0.0",
				IsLatest: true,
			},
		},
	})

	to := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			VersionDetail: &types.VersionDetail{
				Version:  "2.0.0",
				IsLatest: true,
			},
		},
	})

	result := engine.Compare(from, to)

	assert.Len(t, result.UpdatedServers, 1)
	change := result.UpdatedServers[0]

	assert.Equal(t, "1.0.0", change.PreviousVersion)
	assert.Equal(t, "2.0.0", change.NewVersion)

	// Should have version in field changes
	hasVersionChange := false
	for _, fc := range change.FieldChanges {
		if fc.Field == "version" {
			hasVersionChange = true
			assert.Equal(t, "1.0.0", fc.OldValue)
			assert.Equal(t, "2.0.0", fc.NewValue)
		}
	}
	assert.True(t, hasVersionChange)
}

func TestEngine_Compare_PackageChanges(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			Packages: []types.Package{
				{RegistryType: "npm", Name: "@example/server", Version: "1.0.0"},
			},
		},
	})

	to := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			Packages: []types.Package{
				{RegistryType: "npm", Name: "@example/server", Version: "2.0.0"},
			},
		},
	})

	result := engine.Compare(from, to)

	assert.Len(t, result.UpdatedServers, 1)

	// Should have packages in field changes
	hasPackagesChange := false
	for _, fc := range result.UpdatedServers[0].FieldChanges {
		if fc.Field == "packages" {
			hasPackagesChange = true
		}
	}
	assert.True(t, hasPackagesChange)
}

func TestEngine_Compare_RemoteChanges(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			Remotes: []types.Remote{
				{TransportType: "sse", URL: "https://old.example.com/sse"},
			},
		},
	})

	to := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			Remotes: []types.Remote{
				{TransportType: "sse", URL: "https://new.example.com/sse"},
			},
		},
	})

	result := engine.Compare(from, to)

	assert.Len(t, result.UpdatedServers, 1)

	// Should have remotes in field changes
	hasRemotesChange := false
	for _, fc := range result.UpdatedServers[0].FieldChanges {
		if fc.Field == "remotes" {
			hasRemotesChange = true
		}
	}
	assert.True(t, hasRemotesChange)
}

func TestEngine_Compare_RepositoryChange(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			Repository: &types.Repository{
				URL:    "https://github.com/old/repo",
				Source: "github",
			},
		},
	})

	to := engine.CreateSnapshot([]types.Server{
		{
			Name: "server1",
			Repository: &types.Repository{
				URL:    "https://github.com/new/repo",
				Source: "github",
			},
		},
	})

	result := engine.Compare(from, to)

	assert.Len(t, result.UpdatedServers, 1)

	// Should have repository in field changes
	hasRepoChange := false
	for _, fc := range result.UpdatedServers[0].FieldChanges {
		if fc.Field == "repository" {
			hasRepoChange = true
		}
	}
	assert.True(t, hasRepoChange)
}

func TestEngine_Compare_NoChanges(t *testing.T) {
	engine := NewEngine()

	servers := []types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
	}

	from := engine.CreateSnapshot(servers)
	to := engine.CreateSnapshot(servers)

	result := engine.Compare(from, to)

	assert.Empty(t, result.NewServers)
	assert.Empty(t, result.UpdatedServers)
	assert.Empty(t, result.RemovedServers)
	assert.Equal(t, 0, result.TotalChanges)
}

func TestEngine_Compare_MixedChanges(t *testing.T) {
	engine := NewEngine()

	from := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Original"},
		{Name: "server2", Description: "Will be removed"},
	})

	to := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Modified"},
		{Name: "server3", Description: "New server"},
	})

	result := engine.Compare(from, to)

	assert.Len(t, result.NewServers, 1)
	assert.Equal(t, "server3", result.NewServers[0].ServerName)

	assert.Len(t, result.UpdatedServers, 1)
	assert.Equal(t, "server1", result.UpdatedServers[0].ServerName)

	assert.Len(t, result.RemovedServers, 1)
	assert.Equal(t, "server2", result.RemovedServers[0].ServerName)

	assert.Equal(t, 3, result.TotalChanges)
}

func TestEngine_HasChanges(t *testing.T) {
	engine := NewEngine()

	tests := []struct {
		name     string
		from     *types.Snapshot
		to       *types.Snapshot
		expected bool
	}{
		{
			name:     "both nil",
			from:     nil,
			to:       nil,
			expected: true,
		},
		{
			name:     "from nil",
			from:     nil,
			to:       engine.CreateSnapshot([]types.Server{{Name: "s1"}}),
			expected: true,
		},
		{
			name:     "to nil",
			from:     engine.CreateSnapshot([]types.Server{{Name: "s1"}}),
			to:       nil,
			expected: true,
		},
		{
			name:     "same hash",
			from:     &types.Snapshot{Hash: "abc123"},
			to:       &types.Snapshot{Hash: "abc123"},
			expected: false,
		},
		{
			name:     "different hash",
			from:     &types.Snapshot{Hash: "abc123"},
			to:       &types.Snapshot{Hash: "xyz789"},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := engine.HasChanges(tt.from, tt.to)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEngine_HashConsistency(t *testing.T) {
	engine := NewEngine()

	servers := []types.Server{
		{Name: "server1", Description: "Server 1"},
		{Name: "server2", Description: "Server 2"},
	}

	// Same servers should produce same hash
	snapshot1 := engine.CreateSnapshot(servers)
	snapshot2 := engine.CreateSnapshot(servers)

	assert.Equal(t, snapshot1.Hash, snapshot2.Hash)

	// Different order should produce same hash (since we use a map)
	serversReversed := []types.Server{
		{Name: "server2", Description: "Server 2"},
		{Name: "server1", Description: "Server 1"},
	}
	snapshot3 := engine.CreateSnapshot(serversReversed)
	assert.Equal(t, snapshot1.Hash, snapshot3.Hash)
}

func TestEngine_HashDifferent(t *testing.T) {
	engine := NewEngine()

	snapshot1 := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Server 1"},
	})

	snapshot2 := engine.CreateSnapshot([]types.Server{
		{Name: "server1", Description: "Different description"},
	})

	assert.NotEqual(t, snapshot1.Hash, snapshot2.Hash)
}

func TestFilterChanges_Empty(t *testing.T) {
	result := &types.DiffResult{
		NewServers:     []types.Change{},
		UpdatedServers: []types.Change{},
		RemovedServers: []types.Change{},
	}

	filter := types.SubscriptionFilter{}

	filtered := FilterChanges(result, filter)

	assert.Empty(t, filtered.NewServers)
	assert.Empty(t, filtered.UpdatedServers)
	assert.Empty(t, filtered.RemovedServers)
	assert.Equal(t, 0, filtered.TotalChanges)
}

func TestFilterChanges_ByChangeType(t *testing.T) {
	result := &types.DiffResult{
		NewServers: []types.Change{
			{ServerName: "new1", ChangeType: types.ChangeTypeNew},
		},
		UpdatedServers: []types.Change{
			{ServerName: "updated1", ChangeType: types.ChangeTypeUpdated},
		},
		RemovedServers: []types.Change{
			{ServerName: "removed1", ChangeType: types.ChangeTypeRemoved},
		},
	}

	// Filter for only new servers
	filter := types.SubscriptionFilter{
		ChangeTypes: []types.ChangeType{types.ChangeTypeNew},
	}

	filtered := FilterChanges(result, filter)

	assert.Len(t, filtered.NewServers, 1)
	assert.Empty(t, filtered.UpdatedServers)
	assert.Empty(t, filtered.RemovedServers)
	assert.Equal(t, 1, filtered.TotalChanges)
}

func TestFilterChanges_ByServer(t *testing.T) {
	result := &types.DiffResult{
		NewServers: []types.Change{
			{ServerName: "server1", ChangeType: types.ChangeTypeNew},
			{ServerName: "server2", ChangeType: types.ChangeTypeNew},
			{ServerName: "server3", ChangeType: types.ChangeTypeNew},
		},
	}

	filter := types.SubscriptionFilter{
		Servers: []string{"server1", "server3"},
	}

	filtered := FilterChanges(result, filter)

	assert.Len(t, filtered.NewServers, 2)
	assert.Equal(t, "server1", filtered.NewServers[0].ServerName)
	assert.Equal(t, "server3", filtered.NewServers[1].ServerName)
}

func TestFilterChanges_ByNamespace(t *testing.T) {
	result := &types.DiffResult{
		NewServers: []types.Change{
			{ServerName: "io.github.user/server1", ChangeType: types.ChangeTypeNew},
			{ServerName: "io.github.other/server2", ChangeType: types.ChangeTypeNew},
			{ServerName: "com.example/server3", ChangeType: types.ChangeTypeNew},
		},
	}

	filter := types.SubscriptionFilter{
		Namespaces: []string{"io.github.*"},
	}

	filtered := FilterChanges(result, filter)

	assert.Len(t, filtered.NewServers, 2)
}

func TestFilterChanges_ByKeywords(t *testing.T) {
	result := &types.DiffResult{
		NewServers: []types.Change{
			{
				ServerName: "ai-server",
				ChangeType: types.ChangeTypeNew,
				Server:     &types.Server{Name: "ai-server", Description: "Machine learning server"},
			},
			{
				ServerName: "database-server",
				ChangeType: types.ChangeTypeNew,
				Server:     &types.Server{Name: "database-server", Description: "PostgreSQL connector"},
			},
			{
				ServerName: "web-server",
				ChangeType: types.ChangeTypeNew,
				Server:     &types.Server{Name: "web-server", Description: "HTTP server"},
			},
		},
	}

	filter := types.SubscriptionFilter{
		Keywords: []string{"machine learning", "postgres"},
	}

	filtered := FilterChanges(result, filter)

	assert.Len(t, filtered.NewServers, 2)
}

func TestFilterChanges_ByPackageType(t *testing.T) {
	result := &types.DiffResult{
		NewServers: []types.Change{
			{
				ServerName: "npm-server",
				ChangeType: types.ChangeTypeNew,
				Server: &types.Server{
					Name: "npm-server",
					Packages: []types.Package{
						{RegistryType: "npm", Name: "@example/npm-pkg"},
					},
				},
			},
			{
				ServerName: "pypi-server",
				ChangeType: types.ChangeTypeNew,
				Server: &types.Server{
					Name: "pypi-server",
					Packages: []types.Package{
						{RegistryType: "pypi", Name: "example-pkg"},
					},
				},
			},
			{
				ServerName: "no-packages",
				ChangeType: types.ChangeTypeNew,
				Server:     &types.Server{Name: "no-packages"},
			},
		},
	}

	filter := types.SubscriptionFilter{
		PackageTypes: []string{"npm"},
	}

	filtered := FilterChanges(result, filter)

	assert.Len(t, filtered.NewServers, 1)
	assert.Equal(t, "npm-server", filtered.NewServers[0].ServerName)
}

func TestFilterChanges_CombinedFilters(t *testing.T) {
	result := &types.DiffResult{
		NewServers: []types.Change{
			{
				ServerName: "io.github.user/ai-server",
				ChangeType: types.ChangeTypeNew,
				Server: &types.Server{
					Name:        "io.github.user/ai-server",
					Description: "AI assistant",
				},
			},
			{
				ServerName: "io.github.user/db-server",
				ChangeType: types.ChangeTypeNew,
				Server: &types.Server{
					Name:        "io.github.user/db-server",
					Description: "Database connector",
				},
			},
		},
		UpdatedServers: []types.Change{
			{
				ServerName: "io.github.user/ai-updated",
				ChangeType: types.ChangeTypeUpdated,
				Server: &types.Server{
					Name:        "io.github.user/ai-updated",
					Description: "Updated AI",
				},
			},
		},
	}

	// Filter for new servers in io.github.* namespace with "AI" keyword
	filter := types.SubscriptionFilter{
		Namespaces:  []string{"io.github.*"},
		Keywords:    []string{"ai"},
		ChangeTypes: []types.ChangeType{types.ChangeTypeNew},
	}

	filtered := FilterChanges(result, filter)

	assert.Len(t, filtered.NewServers, 1)
	assert.Equal(t, "io.github.user/ai-server", filtered.NewServers[0].ServerName)
	assert.Empty(t, filtered.UpdatedServers) // Filtered out by change type
}

func TestMatchNamespace(t *testing.T) {
	tests := []struct {
		name     string
		server   string
		pattern  string
		expected bool
	}{
		{"wildcard matches all", "anything", "*", true},
		{"exact match", "server1", "server1", true},
		{"exact no match", "server1", "server2", false},
		{"prefix wildcard match", "io.github.user/server", "io.github.*", true},
		{"prefix wildcard no match", "com.example/server", "io.github.*", false},
		{"directory wildcard match", "io.github.user/pkg", "io.github.user/*", true},
		{"directory wildcard no match", "io.github.other/pkg", "io.github.user/*", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := matchNamespace(tt.server, tt.pattern)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSerializeDeserializeSnapshot(t *testing.T) {
	original := &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC().Truncate(time.Millisecond),
		ServerCount: 2,
		Hash:        "test-hash",
		Servers: map[string]types.Server{
			"server1": {Name: "server1", Description: "Test 1"},
			"server2": {Name: "server2", Description: "Test 2"},
		},
	}

	// Serialize
	data, err := SerializeSnapshot(original)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	// Deserialize
	restored, err := DeserializeSnapshot(data)
	require.NoError(t, err)
	require.NotNil(t, restored)

	assert.Equal(t, original.ID, restored.ID)
	assert.Equal(t, original.ServerCount, restored.ServerCount)
	assert.Equal(t, original.Hash, restored.Hash)
	assert.Equal(t, len(original.Servers), len(restored.Servers))
	assert.Equal(t, original.Servers["server1"].Description, restored.Servers["server1"].Description)
}

func TestDeserializeSnapshot_Invalid(t *testing.T) {
	_, err := DeserializeSnapshot([]byte("invalid json"))
	assert.Error(t, err)
}

func TestSortChanges(t *testing.T) {
	changes := []types.Change{
		{ServerName: "zebra"},
		{ServerName: "apple"},
		{ServerName: "mango"},
		{ServerName: "banana"},
	}

	sortChanges(changes)

	assert.Equal(t, "apple", changes[0].ServerName)
	assert.Equal(t, "banana", changes[1].ServerName)
	assert.Equal(t, "mango", changes[2].ServerName)
	assert.Equal(t, "zebra", changes[3].ServerName)
}
