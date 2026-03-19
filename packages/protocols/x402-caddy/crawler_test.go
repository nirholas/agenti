package caddyx402

import "testing"

func TestCrawlerDetector_BuiltinPatterns(t *testing.T) {
	detector, err := NewCrawlerDetector(nil)
	if err != nil {
		t.Fatal(err)
	}

	crawlers := []struct {
		ua   string
		want bool
	}{
		{"Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)", true},
		{"Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", true},
		{"Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)", true},
		{"Mozilla/5.0 (compatible; anthropic-ai)", true},
		{"CCBot/2.0 (https://commoncrawl.org/faq/)", true},
		{"PerplexityBot/1.0", true},
		{"Bytespider (https://zhanzhang.toutiao.com/)", true},
		{"Amazonbot/0.1 (https://developer.amazon.com)", true},
		{"Meta-ExternalAgent/1.0", true},
		{"Google-Extended", true},

		// Normal browsers should NOT match.
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", false},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", false},
		{"curl/7.68.0", false},
		{"", false},
	}

	for _, tc := range crawlers {
		got := detector.IsCrawler(tc.ua)
		if got != tc.want {
			t.Errorf("IsCrawler(%q) = %v, want %v", tc.ua, got, tc.want)
		}
	}
}

func TestCrawlerDetector_CustomPatterns(t *testing.T) {
	detector, err := NewCrawlerDetector([]string{"MyCustomBot", `SpecialCrawler/\d+`})
	if err != nil {
		t.Fatal(err)
	}

	if !detector.IsCrawler("MyCustomBot/1.0") {
		t.Error("expected MyCustomBot to be detected")
	}
	if !detector.IsCrawler("SpecialCrawler/42") {
		t.Error("expected SpecialCrawler/42 to be detected")
	}
	// Built-in patterns should still work.
	if !detector.IsCrawler("GPTBot/1.0") {
		t.Error("expected GPTBot to still be detected with custom patterns")
	}
}

func TestCrawlerDetector_MatchedPattern(t *testing.T) {
	detector, err := NewCrawlerDetector(nil)
	if err != nil {
		t.Fatal(err)
	}

	pattern := detector.MatchedPattern("GPTBot/1.0")
	if pattern != "GPTBot" {
		t.Errorf("MatchedPattern(GPTBot/1.0) = %q, want GPTBot", pattern)
	}

	pattern = detector.MatchedPattern("Mozilla/5.0 (compatible; ClaudeBot/1.0)")
	if pattern != "ClaudeBot" {
		t.Errorf("MatchedPattern(ClaudeBot) = %q, want ClaudeBot", pattern)
	}

	pattern = detector.MatchedPattern("Mozilla/5.0")
	if pattern != "" {
		t.Errorf("expected no pattern for Mozilla, got %q", pattern)
	}

	pattern = detector.MatchedPattern("")
	if pattern != "" {
		t.Errorf("expected no pattern for empty string, got %q", pattern)
	}
}

func TestCrawlerDetector_CaseInsensitive(t *testing.T) {
	detector, err := NewCrawlerDetector(nil)
	if err != nil {
		t.Fatal(err)
	}

	if !detector.IsCrawler("gptbot/1.0") {
		t.Error("expected case-insensitive match for gptbot")
	}
	if !detector.IsCrawler("CLAUDEBOT") {
		t.Error("expected case-insensitive match for CLAUDEBOT")
	}
}

func TestCrawlerDetector_InvalidRegex(t *testing.T) {
	_, err := NewCrawlerDetector([]string{"[invalid"})
	if err == nil {
		t.Error("expected error for invalid regex pattern")
	}
}
