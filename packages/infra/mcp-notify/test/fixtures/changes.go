package fixtures

import (
	"time"

	"github.com/google/uuid"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// TestChanges provides sample change data for testing.
var TestChanges = []types.Change{
	{
		ID:         uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		SnapshotID: uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
		ServerName: "io.github.test/server-new",
		ChangeType: types.ChangeTypeNew,
		NewVersion: "1.0.0",
		Server: &types.Server{
			Name:        "io.github.test/server-new",
			Description: "A newly added server",
			VersionDetail: &types.VersionDetail{
				Version:  "1.0.0",
				IsLatest: true,
			},
		},
		DetectedAt: time.Now().Add(-2 * time.Hour),
	},
	{
		ID:              uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		SnapshotID:      uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
		ServerName:      "io.github.test/server-updated",
		ChangeType:      types.ChangeTypeUpdated,
		PreviousVersion: "1.0.0",
		NewVersion:      "2.0.0",
		FieldChanges: []types.FieldChange{
			{
				Field:    "version",
				OldValue: "1.0.0",
				NewValue: "2.0.0",
			},
			{
				Field:    "description",
				OldValue: "Original description",
				NewValue: "Updated description",
			},
		},
		Server: &types.Server{
			Name:        "io.github.test/server-updated",
			Description: "Updated description",
			VersionDetail: &types.VersionDetail{
				Version:  "2.0.0",
				IsLatest: true,
			},
		},
		PreviousServer: &types.Server{
			Name:        "io.github.test/server-updated",
			Description: "Original description",
			VersionDetail: &types.VersionDetail{
				Version:  "1.0.0",
				IsLatest: true,
			},
		},
		DetectedAt: time.Now().Add(-5 * time.Hour),
	},
	{
		ID:              uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		SnapshotID:      uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
		ServerName:      "io.github.test/server-removed",
		ChangeType:      types.ChangeTypeRemoved,
		PreviousVersion: "3.0.0",
		PreviousServer: &types.Server{
			Name:        "io.github.test/server-removed",
			Description: "This server was removed",
			VersionDetail: &types.VersionDetail{
				Version:  "3.0.0",
				IsLatest: true,
			},
		},
		DetectedAt: time.Now().Add(-8 * time.Hour),
	},
}

// GenerateTestChanges creates a set of changes with specified counts.
func GenerateTestChanges(newCount, updatedCount, removedCount int) []types.Change {
	snapshotID := uuid.New()
	changes := make([]types.Change, 0, newCount+updatedCount+removedCount)

	for i := 0; i < newCount; i++ {
		changes = append(changes, types.Change{
			ID:         uuid.New(),
			SnapshotID: snapshotID,
			ServerName: "io.github.new/server-" + uuid.New().String()[:8],
			ChangeType: types.ChangeTypeNew,
			NewVersion: "1.0.0",
			DetectedAt: time.Now().Add(-time.Duration(i) * time.Minute),
		})
	}

	for i := 0; i < updatedCount; i++ {
		changes = append(changes, types.Change{
			ID:              uuid.New(),
			SnapshotID:      snapshotID,
			ServerName:      "io.github.updated/server-" + uuid.New().String()[:8],
			ChangeType:      types.ChangeTypeUpdated,
			PreviousVersion: "1.0.0",
			NewVersion:      "2.0.0",
			DetectedAt:      time.Now().Add(-time.Duration(newCount+i) * time.Minute),
		})
	}

	for i := 0; i < removedCount; i++ {
		changes = append(changes, types.Change{
			ID:              uuid.New(),
			SnapshotID:      snapshotID,
			ServerName:      "io.github.removed/server-" + uuid.New().String()[:8],
			ChangeType:      types.ChangeTypeRemoved,
			PreviousVersion: "1.0.0",
			DetectedAt:      time.Now().Add(-time.Duration(newCount+updatedCount+i) * time.Minute),
		})
	}

	return changes
}
