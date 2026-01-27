// Package rss provides RSS and Atom feed generation.
package rss

import (
	"fmt"
	"time"

	"github.com/gorilla/feeds"

	"github.com/nirholas/mcp-notify/internal/diff"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Generator generates RSS and Atom feeds from changes.
type Generator struct {
	title       string
	description string
	baseURL     string
	authorName  string
	authorEmail string
}

// Config holds feed generator configuration.
type Config struct {
	Title       string
	Description string
	BaseURL     string
	AuthorName  string
	AuthorEmail string
}

// NewGenerator creates a new feed generator.
func NewGenerator(cfg Config) *Generator {
	return &Generator{
		title:       cfg.Title,
		description: cfg.Description,
		baseURL:     cfg.BaseURL,
		authorName:  cfg.AuthorName,
		authorEmail: cfg.AuthorEmail,
	}
}

// GenerateRSS generates an RSS feed from changes.
func (g *Generator) GenerateRSS(changes []types.Change) (string, error) {
	feed := g.buildFeed(changes)
	return feed.ToRss()
}

// GenerateAtom generates an Atom feed from changes.
func (g *Generator) GenerateAtom(changes []types.Change) (string, error) {
	feed := g.buildFeed(changes)
	return feed.ToAtom()
}

// GenerateJSON generates a JSON feed from changes.
func (g *Generator) GenerateJSON(changes []types.Change) (string, error) {
	feed := g.buildFeed(changes)
	return feed.ToJSON()
}

func (g *Generator) buildFeed(changes []types.Change) *feeds.Feed {
	now := time.Now()

	feed := &feeds.Feed{
		Title:       g.title,
		Link:        &feeds.Link{Href: g.baseURL},
		Description: g.description,
		Author:      &feeds.Author{Name: g.authorName, Email: g.authorEmail},
		Created:     now,
		Updated:     now,
	}

	for _, change := range changes {
		item := g.buildFeedItem(change)
		feed.Items = append(feed.Items, item)
	}

	return feed
}

func (g *Generator) buildFeedItem(change types.Change) *feeds.Item {
	// Build title
	var emoji, action string
	switch change.ChangeType {
	case types.ChangeTypeNew:
		emoji = "🆕"
		action = "New"
	case types.ChangeTypeUpdated:
		emoji = "📝"
		action = "Updated"
	case types.ChangeTypeRemoved:
		emoji = "🗑️"
		action = "Removed"
	}

	title := fmt.Sprintf("%s %s: %s", emoji, action, change.ServerName)

	// Build description
	var description string
	if change.Server != nil && change.Server.Description != "" {
		description = change.Server.Description
	}

	if change.ChangeType == types.ChangeTypeUpdated && change.PreviousVersion != "" && change.NewVersion != "" {
		if description != "" {
			description += "\n\n"
		}
		description += fmt.Sprintf("Version: %s → %s", change.PreviousVersion, change.NewVersion)
	}

	// Build content (HTML)
	content := g.buildItemContent(change)

	// Registry URL
	registryURL := fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName)

	return &feeds.Item{
		Id:          change.ID.String(),
		Title:       title,
		Link:        &feeds.Link{Href: registryURL},
		Description: description,
		Content:     content,
		Created:     change.DetectedAt,
		Updated:     change.DetectedAt,
	}
}

func (g *Generator) buildItemContent(change types.Change) string {
	html := "<div>"

	// Server info
	html += fmt.Sprintf("<h3>%s</h3>", change.ServerName)

	if change.Server != nil {
		if change.Server.Description != "" {
			html += fmt.Sprintf("<p>%s</p>", change.Server.Description)
		}

		// Version
		if change.ChangeType == types.ChangeTypeUpdated && change.PreviousVersion != "" && change.NewVersion != "" {
			html += fmt.Sprintf("<p><strong>Version:</strong> %s → %s</p>", change.PreviousVersion, change.NewVersion)
		} else if change.NewVersion != "" {
			html += fmt.Sprintf("<p><strong>Version:</strong> %s</p>", change.NewVersion)
		}

		// Packages
		if len(change.Server.Packages) > 0 {
			html += "<p><strong>Packages:</strong> "
			for i, pkg := range change.Server.Packages {
				if i > 0 {
					html += ", "
				}
				if pkg.URL != "" {
					html += fmt.Sprintf("<a href=\"%s\">%s</a>", pkg.URL, pkg.RegistryType)
				} else {
					html += pkg.RegistryType
				}
			}
			html += "</p>"
		}

		// Repository
		if change.Server.Repository != nil && change.Server.Repository.URL != "" {
			html += fmt.Sprintf("<p><strong>Repository:</strong> <a href=\"%s\">%s</a></p>",
				change.Server.Repository.URL, change.Server.Repository.Source)
		}
	}

	// Field changes for updates
	if change.ChangeType == types.ChangeTypeUpdated && len(change.FieldChanges) > 0 {
		html += "<p><strong>Changed fields:</strong></p><ul>"
		for _, fc := range change.FieldChanges {
			html += fmt.Sprintf("<li>%s</li>", fc.Field)
		}
		html += "</ul>"
	}

	// Links
	registryURL := fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName)
	html += fmt.Sprintf("<p><a href=\"%s\">View in Registry</a></p>", registryURL)

	html += "</div>"
	return html
}

// FilteredFeed generates a feed for a specific subscription filter.
func (g *Generator) FilteredFeed(changes []types.Change, filter types.SubscriptionFilter) (*feeds.Feed, error) {
	// Apply filter to changes
	var filtered []types.Change
	for _, change := range changes {
		if diff.MatchesFilter(change, filter) {
			filtered = append(filtered, change)
		}
	}

	return g.buildFeed(filtered), nil
}

