package caddyx402

import (
	"regexp"
)

// builtinCrawlerPatterns are known AI crawler User-Agent substrings and patterns.
var builtinCrawlerPatterns = []string{
	// OpenAI
	`GPTBot`,
	`ChatGPT-User`,
	`OAI-SearchBot`,

	// Google
	`Google-Extended`,
	`Googlebot-Extended`,

	// Anthropic
	`anthropic-ai`,
	`Claude-Web`,
	`ClaudeBot`,

	// Meta
	`FacebookBot`,
	`Meta-ExternalAgent`,
	`meta-externalagent`,

	// Apple
	`Applebot-Extended`,

	// Common Crawl
	`CCBot`,

	// Perplexity
	`PerplexityBot`,

	// Amazon / Alexa
	`Amazonbot`,

	// Cohere
	`cohere-ai`,

	// AI2
	`Ai2Bot`,

	// Bytedance
	`Bytespider`,

	// Other known AI crawlers
	`SemrushBot`,
	`AhrefsBot`,
	`DataForSeoBot`,
	`PetalBot`,
	`YouBot`,
	`Diffbot`,
	`Timpibot`,
	`ImagesiftBot`,
	`Kangaroo Bot`,
	`Sidetrade indexer bot`,
	`Webz\.io`,
	`img2dataset`,
}

// crawlerEntry holds a compiled regex alongside the original pattern string.
type crawlerEntry struct {
	pattern string
	re      *regexp.Regexp
}

// CrawlerDetector holds compiled regex patterns for matching AI crawler User-Agents.
type CrawlerDetector struct {
	entries []crawlerEntry
}

// NewCrawlerDetector creates a detector with built-in patterns plus any custom ones.
func NewCrawlerDetector(customPatterns []string) (*CrawlerDetector, error) {
	allPatterns := make([]string, 0, len(builtinCrawlerPatterns)+len(customPatterns))
	allPatterns = append(allPatterns, builtinCrawlerPatterns...)
	allPatterns = append(allPatterns, customPatterns...)

	entries := make([]crawlerEntry, 0, len(allPatterns))
	for _, p := range allPatterns {
		re, err := regexp.Compile(`(?i)` + p)
		if err != nil {
			return nil, err
		}
		entries = append(entries, crawlerEntry{pattern: p, re: re})
	}

	return &CrawlerDetector{entries: entries}, nil
}

// IsCrawler returns true if the User-Agent matches any known AI crawler pattern.
func (d *CrawlerDetector) IsCrawler(userAgent string) bool {
	if userAgent == "" {
		return false
	}
	for _, e := range d.entries {
		if e.re.MatchString(userAgent) {
			return true
		}
	}
	return false
}

// MatchedPattern returns the first matching pattern name, or empty string.
func (d *CrawlerDetector) MatchedPattern(userAgent string) string {
	if userAgent == "" {
		return ""
	}
	for _, e := range d.entries {
		if e.re.MatchString(userAgent) {
			return e.pattern
		}
	}
	return ""
}
