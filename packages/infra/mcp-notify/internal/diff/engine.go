// Package diff provides change detection between registry snapshots.
package diff

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Engine detects changes between registry snapshots.
type Engine struct{}

// NewEngine creates a new diff engine.
func NewEngine() *Engine {
	return &Engine{}
}

// CreateSnapshot creates a new snapshot from a list of servers.
func (e *Engine) CreateSnapshot(servers []types.Server) *types.Snapshot {
	serverMap := make(map[string]types.Server, len(servers))
	for _, s := range servers {
		serverMap[s.Name] = s
	}

	// Compute content hash for quick comparison
	hash := e.computeHash(serverMap)

	return &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC(),
		Servers:     serverMap,
		ServerCount: len(servers),
		Hash:        hash,
	}
}

// Compare compares two snapshots and returns the differences.
func (e *Engine) Compare(from, to *types.Snapshot) *types.DiffResult {
	result := &types.DiffResult{
		FromSnapshot:   from,
		ToSnapshot:     to,
		NewServers:     []types.Change{},
		UpdatedServers: []types.Change{},
		RemovedServers: []types.Change{},
	}

	// Handle nil snapshots
	if from == nil && to == nil {
		return result
	}

	// If to is nil, we can't detect changes (nothing to compare to)
	if to == nil {
		return result
	}

	fromServers := make(map[string]types.Server)
	toServers := make(map[string]types.Server)

	if from != nil {
		fromServers = from.Servers
	}
	if to != nil {
		toServers = to.Servers
	}

	// Find new and updated servers
	for name, toServer := range toServers {
		fromServer, exists := fromServers[name]

		if !exists {
			// New server
			change := types.Change{
				ID:         uuid.New(),
				SnapshotID: to.ID,
				ServerName: name,
				ChangeType: types.ChangeTypeNew,
				NewVersion: getVersion(toServer),
				Server:     &toServer,
				DetectedAt: time.Now().UTC(),
			}
			result.NewServers = append(result.NewServers, change)
		} else if !e.serversEqual(fromServer, toServer) {
			// Updated server
			fieldChanges := e.detectFieldChanges(fromServer, toServer)
			serverCopy := toServer
			fromCopy := fromServer

			change := types.Change{
				ID:              uuid.New(),
				SnapshotID:      to.ID,
				ServerName:      name,
				ChangeType:      types.ChangeTypeUpdated,
				PreviousVersion: getVersion(fromServer),
				NewVersion:      getVersion(toServer),
				FieldChanges:    fieldChanges,
				Server:          &serverCopy,
				PreviousServer:  &fromCopy,
				DetectedAt:      time.Now().UTC(),
			}
			result.UpdatedServers = append(result.UpdatedServers, change)
		}
	}

	// Find removed servers
	for name, fromServer := range fromServers {
		if _, exists := toServers[name]; !exists {
			serverCopy := fromServer
			change := types.Change{
				ID:              uuid.New(),
				SnapshotID:      to.ID,
				ServerName:      name,
				ChangeType:      types.ChangeTypeRemoved,
				PreviousVersion: getVersion(fromServer),
				PreviousServer:  &serverCopy,
				DetectedAt:      time.Now().UTC(),
			}
			result.RemovedServers = append(result.RemovedServers, change)
		}
	}

	// Sort changes by server name for consistent ordering
	sortChanges(result.NewServers)
	sortChanges(result.UpdatedServers)
	sortChanges(result.RemovedServers)

	result.TotalChanges = len(result.NewServers) + len(result.UpdatedServers) + len(result.RemovedServers)

	return result
}

// HasChanges checks if two snapshots have any differences using hash comparison.
// This is a quick check before doing a full comparison.
func (e *Engine) HasChanges(from, to *types.Snapshot) bool {
	if from == nil || to == nil {
		return true
	}
	return from.Hash != to.Hash
}

// serversEqual checks if two servers are equal.
func (e *Engine) serversEqual(a, b types.Server) bool {
	// Compare key fields
	if a.Name != b.Name ||
		a.Description != b.Description {
		return false
	}

	// Compare version
	if getVersion(a) != getVersion(b) {
		return false
	}

	// Compare packages
	if !packagesEqual(a.Packages, b.Packages) {
		return false
	}

	// Compare remotes
	if !remotesEqual(a.Remotes, b.Remotes) {
		return false
	}

	// Compare repository
	if !repositoriesEqual(a.Repository, b.Repository) {
		return false
	}

	return true
}

// detectFieldChanges detects which specific fields changed between two servers.
func (e *Engine) detectFieldChanges(from, to types.Server) []types.FieldChange {
	var changes []types.FieldChange

	if from.Description != to.Description {
		changes = append(changes, types.FieldChange{
			Field:    "description",
			OldValue: from.Description,
			NewValue: to.Description,
		})
	}

	fromVersion := getVersion(from)
	toVersion := getVersion(to)
	if fromVersion != toVersion {
		changes = append(changes, types.FieldChange{
			Field:    "version",
			OldValue: fromVersion,
			NewValue: toVersion,
		})
	}

	if !packagesEqual(from.Packages, to.Packages) {
		changes = append(changes, types.FieldChange{
			Field:    "packages",
			OldValue: from.Packages,
			NewValue: to.Packages,
		})
	}

	if !remotesEqual(from.Remotes, to.Remotes) {
		changes = append(changes, types.FieldChange{
			Field:    "remotes",
			OldValue: from.Remotes,
			NewValue: to.Remotes,
		})
	}

	if !repositoriesEqual(from.Repository, to.Repository) {
		changes = append(changes, types.FieldChange{
			Field:    "repository",
			OldValue: from.Repository,
			NewValue: to.Repository,
		})
	}

	return changes
}

// computeHash computes a hash of the server map for quick comparison.
func (e *Engine) computeHash(servers map[string]types.Server) string {
	// Get sorted keys for consistent hashing
	keys := make([]string, 0, len(servers))
	for k := range servers {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Build a string representation
	h := sha256.New()
	for _, k := range keys {
		s := servers[k]
		h.Write([]byte(k))
		h.Write([]byte(s.Description))
		h.Write([]byte(getVersion(s)))

		// Include package info in hash
		for _, p := range s.Packages {
			h.Write([]byte(p.RegistryType))
			h.Write([]byte(p.Name))
			h.Write([]byte(p.Version))
		}

		// Include remote info in hash
		for _, r := range s.Remotes {
			h.Write([]byte(r.TransportType))
			h.Write([]byte(r.URL))
		}
	}

	return hex.EncodeToString(h.Sum(nil))
}

// Helper functions

func getVersion(s types.Server) string {
	if s.VersionDetail != nil {
		return s.VersionDetail.Version
	}
	return ""
}

func packagesEqual(a, b []types.Package) bool {
	if len(a) != len(b) {
		return false
	}

	// Create maps for comparison
	aMap := make(map[string]types.Package)
	for _, p := range a {
		key := p.RegistryType + ":" + p.Name
		aMap[key] = p
	}

	for _, p := range b {
		key := p.RegistryType + ":" + p.Name
		ap, exists := aMap[key]
		if !exists || ap.Version != p.Version || ap.URL != p.URL {
			return false
		}
	}

	return true
}

func remotesEqual(a, b []types.Remote) bool {
	if len(a) != len(b) {
		return false
	}

	aMap := make(map[string]types.Remote)
	for _, r := range a {
		key := r.TransportType + ":" + r.URL
		aMap[key] = r
	}

	for _, r := range b {
		key := r.TransportType + ":" + r.URL
		if _, exists := aMap[key]; !exists {
			return false
		}
	}

	return true
}

func repositoriesEqual(a, b *types.Repository) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.URL == b.URL && a.Source == b.Source
}

func sortChanges(changes []types.Change) {
	sort.Slice(changes, func(i, j int) bool {
		return changes[i].ServerName < changes[j].ServerName
	})
}

// FilterChanges filters a diff result based on subscription filters.
func FilterChanges(result *types.DiffResult, filter types.SubscriptionFilter) *types.DiffResult {
	filtered := &types.DiffResult{
		FromSnapshot:   result.FromSnapshot,
		ToSnapshot:     result.ToSnapshot,
		NewServers:     filterChangeList(result.NewServers, filter),
		UpdatedServers: filterChangeList(result.UpdatedServers, filter),
		RemovedServers: filterChangeList(result.RemovedServers, filter),
	}
	filtered.TotalChanges = len(filtered.NewServers) + len(filtered.UpdatedServers) + len(filtered.RemovedServers)
	return filtered
}

func filterChangeList(changes []types.Change, filter types.SubscriptionFilter) []types.Change {
	var filtered []types.Change

	for _, change := range changes {
		if MatchesFilter(change, filter) {
			filtered = append(filtered, change)
		}
	}

	return filtered
}

// MatchesFilter checks if a change matches a subscription filter.
func MatchesFilter(change types.Change, filter types.SubscriptionFilter) bool {
	// Check change types filter
	if len(filter.ChangeTypes) > 0 {
		found := false
		for _, ct := range filter.ChangeTypes {
			if ct == change.ChangeType {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check specific servers filter
	if len(filter.Servers) > 0 {
		found := false
		for _, s := range filter.Servers {
			if s == change.ServerName {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check namespace patterns
	if len(filter.Namespaces) > 0 {
		matched := false
		for _, pattern := range filter.Namespaces {
			if matchNamespace(change.ServerName, pattern) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check keywords
	if len(filter.Keywords) > 0 {
		matched := false
		searchText := strings.ToLower(change.ServerName)
		if change.Server != nil {
			searchText += " " + strings.ToLower(change.Server.Description)
		}
		for _, kw := range filter.Keywords {
			if strings.Contains(searchText, strings.ToLower(kw)) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check package types
	if len(filter.PackageTypes) > 0 && change.Server != nil {
		matched := false
		for _, pt := range filter.PackageTypes {
			for _, pkg := range change.Server.Packages {
				if strings.EqualFold(pkg.RegistryType, pt) {
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

// matchNamespace checks if a server name matches a namespace pattern.
// Patterns support * as a wildcard.
func matchNamespace(name, pattern string) bool {
	// Simple glob matching
	if pattern == "*" {
		return true
	}

	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		return strings.HasPrefix(name, prefix+"/")
	}

	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(name, prefix)
	}

	return name == pattern
}

// SerializeSnapshot serializes a snapshot to JSON.
func SerializeSnapshot(snapshot *types.Snapshot) ([]byte, error) {
	return json.Marshal(snapshot)
}

// DeserializeSnapshot deserializes a snapshot from JSON.
func DeserializeSnapshot(data []byte) (*types.Snapshot, error) {
	var snapshot types.Snapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, err
	}
	return &snapshot, nil
}
