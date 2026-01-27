// Package fixtures provides test data for testing.
package fixtures

import (
	"fmt"
	"time"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// TestServers provides sample server data for testing.
var TestServers = []types.Server{
	{
		Name:        "io.github.test/server-a",
		Description: "Test server A - a comprehensive testing server",
		Repository: &types.Repository{
			URL:    "https://github.com/test/server-a",
			Source: "github",
		},
		VersionDetail: &types.VersionDetail{
			Version:  "1.0.0",
			IsLatest: true,
		},
		Packages: []types.Package{
			{
				RegistryType: "npm",
				Name:         "@test/server-a",
				Version:      "1.0.0",
				URL:          "https://www.npmjs.com/package/@test/server-a",
			},
		},
		Remotes: []types.Remote{
			{
				TransportType: "sse",
				URL:           "https://server-a.example.com/sse",
			},
		},
		CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-24 * time.Hour),
	},
	{
		Name:        "io.github.test/server-b",
		Description: "Test server B - blockchain utilities",
		Repository: &types.Repository{
			URL:    "https://github.com/test/server-b",
			Source: "github",
		},
		VersionDetail: &types.VersionDetail{
			Version:  "2.1.0",
			IsLatest: true,
		},
		Packages: []types.Package{
			{
				RegistryType: "pypi",
				Name:         "server-b",
				Version:      "2.1.0",
				URL:          "https://pypi.org/project/server-b/",
			},
		},
		CreatedAt: time.Now().Add(-60 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-12 * time.Hour),
	},
	{
		Name:        "io.github.test/server-c",
		Description: "Test server C - filesystem operations",
		Repository: &types.Repository{
			URL:    "https://github.com/test/server-c",
			Source: "github",
		},
		VersionDetail: &types.VersionDetail{
			Version:  "0.5.0",
			IsLatest: true,
		},
		CreatedAt: time.Now().Add(-90 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-48 * time.Hour),
	},
	{
		Name:        "io.github.defi/swap-server",
		Description: "DeFi swap server for token exchanges",
		Repository: &types.Repository{
			URL:    "https://github.com/defi/swap-server",
			Source: "github",
		},
		VersionDetail: &types.VersionDetail{
			Version:  "3.0.0",
			IsLatest: true,
		},
		Packages: []types.Package{
			{
				RegistryType: "npm",
				Name:         "@defi/swap-server",
				Version:      "3.0.0",
			},
		},
		CreatedAt: time.Now().Add(-15 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-6 * time.Hour),
	},
	{
		Name:        "io.github.ai/llm-connector",
		Description: "LLM connector for AI model integrations",
		Repository: &types.Repository{
			URL:    "https://github.com/ai/llm-connector",
			Source: "github",
		},
		VersionDetail: &types.VersionDetail{
			Version:  "1.2.3",
			IsLatest: true,
		},
		Remotes: []types.Remote{
			{
				TransportType: "streamable-http",
				URL:           "https://llm-connector.example.com/api",
			},
		},
		CreatedAt: time.Now().Add(-7 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-2 * time.Hour),
	},
}

// GetTestServersUpdated provides updated versions of test servers.
// Returns a new slice each time to ensure fresh timestamps.
func GetTestServersUpdated() []types.Server {
	return []types.Server{
		{
			Name:        "io.github.test/server-a",
			Description: "Test server A - a comprehensive testing server (updated)",
			Repository: &types.Repository{
				URL:    "https://github.com/test/server-a",
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  "1.1.0", // Version bumped
				IsLatest: true,
			},
			Packages: []types.Package{
				{
					RegistryType: "npm",
					Name:         "@test/server-a",
					Version:      "1.1.0",
					URL:          "https://www.npmjs.com/package/@test/server-a",
				},
			},
			Remotes: []types.Remote{
				{
					TransportType: "sse",
					URL:           "https://server-a.example.com/sse",
				},
			},
			CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
			UpdatedAt: time.Now(),
		},
		// server-b is unchanged
		{
			Name:        "io.github.test/server-b",
			Description: "Test server B - blockchain utilities",
			Repository: &types.Repository{
				URL:    "https://github.com/test/server-b",
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  "2.1.0",
				IsLatest: true,
			},
			Packages: []types.Package{
				{
					RegistryType: "pypi",
					Name:         "server-b",
					Version:      "2.1.0",
					URL:          "https://pypi.org/project/server-b/",
				},
			},
			CreatedAt: time.Now().Add(-60 * 24 * time.Hour),
			UpdatedAt: time.Now().Add(-12 * time.Hour),
		},
		// server-c is removed (not in this list)
		// server-d is new
		{
			Name:        "io.github.test/server-d",
			Description: "Test server D - new server",
			Repository: &types.Repository{
				URL:    "https://github.com/test/server-d",
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  "1.0.0",
				IsLatest: true,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			Name:        "io.github.defi/swap-server",
			Description: "DeFi swap server for token exchanges",
			Repository: &types.Repository{
				URL:    "https://github.com/defi/swap-server",
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  "3.0.0",
				IsLatest: true,
			},
			Packages: []types.Package{
				{
					RegistryType: "npm",
					Name:         "@defi/swap-server",
					Version:      "3.0.0",
				},
			},
			CreatedAt: time.Now().Add(-15 * 24 * time.Hour),
			UpdatedAt: time.Now().Add(-6 * time.Hour),
		},
		{
			Name:        "io.github.ai/llm-connector",
			Description: "LLM connector for AI model integrations",
			Repository: &types.Repository{
				URL:    "https://github.com/ai/llm-connector",
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  "1.2.3",
				IsLatest: true,
			},
			Remotes: []types.Remote{
				{
					TransportType: "streamable-http",
					URL:           "https://llm-connector.example.com/api",
				},
			},
			CreatedAt: time.Now().Add(-7 * 24 * time.Hour),
			UpdatedAt: time.Now().Add(-2 * time.Hour),
		},
	}
}

// GenerateLargeServerList generates a list of servers for benchmarking.
func GenerateLargeServerList(count int) []types.Server {
	servers := make([]types.Server, count)
	for i := 0; i < count; i++ {
		servers[i] = types.Server{
			Name:        fmt.Sprintf("io.github.bench/server-%05d", i),
			Description: fmt.Sprintf("Benchmark server %d - testing performance", i),
			Repository: &types.Repository{
				URL:    fmt.Sprintf("https://github.com/bench/server-%05d", i),
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  fmt.Sprintf("%d.0.0", (i%10)+1),
				IsLatest: true,
			},
			CreatedAt: time.Now().Add(-time.Duration(i) * time.Hour),
			UpdatedAt: time.Now().Add(-time.Duration(i%24) * time.Hour),
		}
	}
	return servers
}

// GenerateModifiedServerList modifies some servers in the list for diff testing.
func GenerateModifiedServerList(servers []types.Server, numNew, numUpdated, numRemoved int) []types.Server {
	result := make([]types.Server, 0, len(servers)+numNew-numRemoved)

	// Copy existing servers (with some updated)
	for i, s := range servers {
		if i < numRemoved {
			// Skip removed servers
			continue
		}

		if i < numRemoved+numUpdated {
			// Update this server
			s.Description = s.Description + " (updated)"
			if s.VersionDetail != nil {
				s.VersionDetail.Version = fmt.Sprintf("%s.1", s.VersionDetail.Version)
			}
			s.UpdatedAt = time.Now()
		}

		result = append(result, s)
	}

	// Add new servers
	for i := 0; i < numNew; i++ {
		result = append(result, types.Server{
			Name:        fmt.Sprintf("io.github.new/server-%05d", i),
			Description: fmt.Sprintf("New server %d", i),
			Repository: &types.Repository{
				URL:    fmt.Sprintf("https://github.com/new/server-%05d", i),
				Source: "github",
			},
			VersionDetail: &types.VersionDetail{
				Version:  "1.0.0",
				IsLatest: true,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		})
	}

	return result
}
