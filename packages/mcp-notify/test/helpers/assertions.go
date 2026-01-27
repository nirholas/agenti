package helpers

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// AssertChangeEqual compares two changes for equality.
func AssertChangeEqual(t *testing.T, expected, actual types.Change) {
	t.Helper()

	assert.Equal(t, expected.ServerName, actual.ServerName, "server name mismatch")
	assert.Equal(t, expected.ChangeType, actual.ChangeType, "change type mismatch")
	assert.Equal(t, expected.PreviousVersion, actual.PreviousVersion, "previous version mismatch")
	assert.Equal(t, expected.NewVersion, actual.NewVersion, "new version mismatch")
}

// AssertChangeSliceEqual compares two slices of changes.
func AssertChangeSliceEqual(t *testing.T, expected, actual []types.Change) {
	t.Helper()

	assert.Equal(t, len(expected), len(actual), "change slice length mismatch")
	for i := range expected {
		if i < len(actual) {
			AssertChangeEqual(t, expected[i], actual[i])
		}
	}
}

// AssertSubscriptionEqual compares two subscriptions for equality.
func AssertSubscriptionEqual(t *testing.T, expected, actual types.Subscription) {
	t.Helper()

	assert.Equal(t, expected.Name, actual.Name, "name mismatch")
	assert.Equal(t, expected.Description, actual.Description, "description mismatch")
	assert.Equal(t, expected.Status, actual.Status, "status mismatch")
	AssertFiltersEqual(t, expected.Filters, actual.Filters)
}

// AssertFiltersEqual compares two subscription filters.
func AssertFiltersEqual(t *testing.T, expected, actual types.SubscriptionFilter) {
	t.Helper()

	assert.ElementsMatch(t, expected.Namespaces, actual.Namespaces, "namespaces mismatch")
	assert.ElementsMatch(t, expected.Keywords, actual.Keywords, "keywords mismatch")
	assert.ElementsMatch(t, expected.Servers, actual.Servers, "servers mismatch")
	assert.ElementsMatch(t, expected.ChangeTypes, actual.ChangeTypes, "change types mismatch")
}

// AssertServerEqual compares two servers for equality.
func AssertServerEqual(t *testing.T, expected, actual types.Server) {
	t.Helper()

	assert.Equal(t, expected.Name, actual.Name, "name mismatch")
	assert.Equal(t, expected.Description, actual.Description, "description mismatch")

	if expected.VersionDetail != nil {
		assert.NotNil(t, actual.VersionDetail, "version detail is nil")
		if actual.VersionDetail != nil {
			assert.Equal(t, expected.VersionDetail.Version, actual.VersionDetail.Version, "version mismatch")
		}
	}

	if expected.Repository != nil {
		assert.NotNil(t, actual.Repository, "repository is nil")
		if actual.Repository != nil {
			assert.Equal(t, expected.Repository.URL, actual.Repository.URL, "repository URL mismatch")
		}
	}
}

// AssertSnapshotEqual compares two snapshots.
func AssertSnapshotEqual(t *testing.T, expected, actual *types.Snapshot) {
	t.Helper()

	if expected == nil {
		assert.Nil(t, actual, "expected nil snapshot")
		return
	}

	assert.NotNil(t, actual, "snapshot is nil")
	if actual == nil {
		return
	}

	assert.Equal(t, expected.ServerCount, actual.ServerCount, "server count mismatch")
	assert.Equal(t, len(expected.Servers), len(actual.Servers), "servers map size mismatch")

	for name, expectedServer := range expected.Servers {
		actualServer, ok := actual.Servers[name]
		assert.True(t, ok, "server %s not found in actual", name)
		if ok {
			AssertServerEqual(t, expectedServer, actualServer)
		}
	}
}

// AssertDiffResultEqual compares two diff results.
func AssertDiffResultEqual(t *testing.T, expected, actual *types.DiffResult) {
	t.Helper()

	assert.Equal(t, expected.TotalChanges, actual.TotalChanges, "total changes mismatch")
	assert.Equal(t, len(expected.NewServers), len(actual.NewServers), "new servers count mismatch")
	assert.Equal(t, len(expected.UpdatedServers), len(actual.UpdatedServers), "updated servers count mismatch")
	assert.Equal(t, len(expected.RemovedServers), len(actual.RemovedServers), "removed servers count mismatch")
}

// AssertNotificationSent asserts that a notification was sent correctly.
func AssertNotificationSent(t *testing.T, notification types.Notification) {
	t.Helper()

	assert.NotEqual(t, uuid.Nil, notification.ID, "notification ID should not be nil")
	assert.Equal(t, "sent", notification.Status, "notification should be sent")
	assert.NotNil(t, notification.SentAt, "sent at should not be nil")
}

// AssertWithinDuration asserts that a time is within a duration of now.
func AssertWithinDuration(t *testing.T, expected, actual time.Time, delta time.Duration) {
	t.Helper()
	assert.WithinDuration(t, expected, actual, delta)
}

// AssertEventuallyTrue asserts that a condition becomes true within timeout.
func AssertEventuallyTrue(t *testing.T, condition func() bool, timeout time.Duration, msg string) {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Errorf("condition never became true: %s", msg)
}

// AssertContainsChange asserts that a slice contains a change with the given server name.
func AssertContainsChange(t *testing.T, changes []types.Change, serverName string, changeType types.ChangeType) {
	t.Helper()

	for _, c := range changes {
		if c.ServerName == serverName && c.ChangeType == changeType {
			return
		}
	}
	t.Errorf("change not found: server=%s, type=%s", serverName, changeType)
}

// AssertNotContainsChange asserts that a slice does not contain a change with the given server name.
func AssertNotContainsChange(t *testing.T, changes []types.Change, serverName string) {
	t.Helper()

	for _, c := range changes {
		if c.ServerName == serverName {
			t.Errorf("change found but should not exist: server=%s", serverName)
			return
		}
	}
}
