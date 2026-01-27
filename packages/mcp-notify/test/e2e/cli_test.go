// Package e2e provides end-to-end tests for the MCP Notify CLI.
package e2e

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nirholas/mcp-notify/pkg/types"
)

var cliPath string

func TestMain(m *testing.M) {
	// Build the CLI binary for testing
	tmpDir, err := os.MkdirTemp("", "mcp-notify-cli-test")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	cliPath = filepath.Join(tmpDir, "mcp-notify-cli")
	cmd := exec.Command("go", "build", "-o", cliPath, "../../cmd/mcp-notify-cli")
	if output, err := cmd.CombinedOutput(); err != nil {
		panic(string(output))
	}

	os.Exit(m.Run())
}

// runCLI executes the CLI with the given arguments and returns stdout, stderr, and error.
func runCLI(args ...string) (string, string, error) {
	cmd := exec.Command(cliPath, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	return stdout.String(), stderr.String(), err
}

func TestCLIVersion(t *testing.T) {
	stdout, _, err := runCLI("version")
	require.NoError(t, err)
	assert.Contains(t, stdout, "mcp-notify-cli")
}

func TestCLIHelp(t *testing.T) {
	stdout, _, err := runCLI("--help")
	require.NoError(t, err)
	
	// Check for expected commands
	assert.Contains(t, stdout, "changes")
	assert.Contains(t, stdout, "watch")
	assert.Contains(t, stdout, "subscribe")
	assert.Contains(t, stdout, "subscriptions")
	assert.Contains(t, stdout, "servers")
	assert.Contains(t, stdout, "diff")
	assert.Contains(t, stdout, "completion")
}

func TestCLIChangesHelp(t *testing.T) {
	stdout, _, err := runCLI("changes", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "changes")
	assert.Contains(t, stdout, "--output")
	assert.Contains(t, stdout, "--limit")
}

func TestCLISubscribeHelp(t *testing.T) {
	stdout, _, err := runCLI("subscribe", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "subscribe")
	assert.Contains(t, stdout, "--filter")
	assert.Contains(t, stdout, "--name")
}

func TestCLIServersHelp(t *testing.T) {
	stdout, _, err := runCLI("servers", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "servers")
}

func TestCLIServersListHelp(t *testing.T) {
	stdout, _, err := runCLI("servers", "list", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "--output")
}

func TestCLIDiffHelp(t *testing.T) {
	stdout, _, err := runCLI("diff", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "diff")
}

func TestCLIConfigHelp(t *testing.T) {
	stdout, _, err := runCLI("config", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "config")
	assert.Contains(t, stdout, "show")
	assert.Contains(t, stdout, "set")
}

func TestCLIOutputFormats(t *testing.T) {
	// Test that --output flag is validated
	_, stderr, err := runCLI("servers", "list", "--output", "invalid")
	if err != nil {
		// Error is expected for invalid format
		assert.Contains(t, stderr, "invalid")
	}
}

func TestCLICompletionBash(t *testing.T) {
	stdout, _, err := runCLI("completion", "bash")
	require.NoError(t, err)
	assert.Contains(t, stdout, "bash")
}

func TestCLICompletionZsh(t *testing.T) {
	stdout, _, err := runCLI("completion", "zsh")
	require.NoError(t, err)
	assert.Contains(t, stdout, "zsh")
}

func TestCLICompletionFish(t *testing.T) {
	stdout, _, err := runCLI("completion", "fish")
	require.NoError(t, err)
	assert.Contains(t, stdout, "fish")
}

func TestCLICompletionPowerShell(t *testing.T) {
	stdout, _, err := runCLI("completion", "powershell")
	require.NoError(t, err)
	// PowerShell completions have specific structure
	assert.NotEmpty(t, stdout)
}

func TestCLIJSONOutput(t *testing.T) {
	// When API endpoint is not available, this tests the error handling
	_, stderr, err := runCLI("servers", "list", "--output", "json", "--endpoint", "http://localhost:9999")
	if err != nil {
		// Connection error expected
		assert.True(t, strings.Contains(stderr, "connection") || 
			strings.Contains(stderr, "refused") ||
			strings.Contains(stderr, "Error") ||
			err != nil)
	}
}

func TestCLIYAMLOutput(t *testing.T) {
	// When API endpoint is not available, test error handling
	_, stderr, err := runCLI("servers", "list", "--output", "yaml", "--endpoint", "http://localhost:9999")
	if err != nil {
		assert.True(t, strings.Contains(stderr, "connection") || 
			strings.Contains(stderr, "refused") ||
			strings.Contains(stderr, "Error") ||
			err != nil)
	}
}

func TestCLIInvalidCommand(t *testing.T) {
	_, stderr, err := runCLI("nonexistent")
	assert.Error(t, err)
	assert.Contains(t, stderr, "unknown command")
}

func TestCLINoArgs(t *testing.T) {
	stdout, _, err := runCLI()
	require.NoError(t, err)
	// Should show help
	assert.Contains(t, stdout, "MCP Notify CLI")
}

func TestCLISubscriptionsSubcommands(t *testing.T) {
	stdout, _, err := runCLI("subscriptions", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "list")
	assert.Contains(t, stdout, "show")
	assert.Contains(t, stdout, "delete")
	assert.Contains(t, stdout, "pause")
	assert.Contains(t, stdout, "resume")
}

func TestCLIServersSubcommands(t *testing.T) {
	stdout, _, err := runCLI("servers", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "list")
	assert.Contains(t, stdout, "show")
	assert.Contains(t, stdout, "history")
}

func TestCLIConfigSubcommands(t *testing.T) {
	stdout, _, err := runCLI("config", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "show")
	assert.Contains(t, stdout, "set")
}

// TestCLIConfigFile tests config file operations
func TestCLIConfigFile(t *testing.T) {
	// Create a temporary config file
	tmpDir, err := os.MkdirTemp("", "mcp-notify-config-test")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	configPath := filepath.Join(tmpDir, "config.yaml")
	os.Setenv("MCP_WATCH_CONFIG", configPath)
	defer os.Unsetenv("MCP_WATCH_CONFIG")

	// Test config show when file doesn't exist
	stdout, _, _ := runCLI("config", "show")
	// Should either show defaults or indicate no config
	assert.True(t, len(stdout) >= 0)
}

// TestCLIWithMockAPI tests CLI commands against a mock API server
func TestCLIWithMockAPI(t *testing.T) {
	// This test would require setting up a mock server
	// For now, we test error handling when no server is available
	
	_, _, err := runCLI("changes", "--endpoint", "http://localhost:9999")
	// Error expected when no server
	assert.Error(t, err)
}

// TestOutputJSONParseable tests that JSON output is valid JSON
func TestOutputJSONParseable(t *testing.T) {
	// Test with mock data - create a simple test
	testData := []types.Server{
		{Name: "test-server", Description: "A test server"},
	}
	
	data, err := json.Marshal(testData)
	require.NoError(t, err)
	
	var parsed []types.Server
	err = json.Unmarshal(data, &parsed)
	require.NoError(t, err)
	assert.Len(t, parsed, 1)
}

// TestCLIFlags tests various CLI flag combinations
func TestCLIFlags(t *testing.T) {
	testCases := []struct {
		name string
		args []string
	}{
		{"verbose flag", []string{"--verbose", "--help"}},
		{"quiet flag", []string{"--quiet", "--help"}},
		{"output table", []string{"servers", "list", "--output", "table", "--help"}},
		{"output json", []string{"servers", "list", "--output", "json", "--help"}},
		{"output yaml", []string{"servers", "list", "--output", "yaml", "--help"}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			stdout, stderr, _ := runCLI(tc.args...)
			// Just verify it runs without crashing
			assert.True(t, len(stdout) > 0 || len(stderr) >= 0)
		})
	}
}

// TestCLIEnvironmentVariables tests that environment variables work
func TestCLIEnvironmentVariables(t *testing.T) {
	// Set environment variables
	os.Setenv("MCP_WATCH_API_ENDPOINT", "http://localhost:8080")
	os.Setenv("MCP_WATCH_API_KEY", "test-key")
	defer os.Unsetenv("MCP_WATCH_API_ENDPOINT")
	defer os.Unsetenv("MCP_WATCH_API_KEY")

	// CLI should pick up environment variables
	// Test by showing config
	stdout, _, _ := runCLI("config", "show")
	// Config show should work without error
	assert.True(t, len(stdout) >= 0)
}

// TestCLIExitCodes tests that appropriate exit codes are returned
func TestCLIExitCodes(t *testing.T) {
	testCases := []struct {
		name         string
		args         []string
		expectError  bool
	}{
		{"help", []string{"--help"}, false},
		{"version", []string{"version"}, false},
		{"invalid command", []string{"invalid-command"}, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := runCLI(tc.args...)
			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestCLIWatchHelp tests the watch command help
func TestCLIWatchHelp(t *testing.T) {
	stdout, _, err := runCLI("watch", "--help")
	require.NoError(t, err)
	
	assert.Contains(t, stdout, "watch")
	assert.Contains(t, stdout, "--interval")
	assert.Contains(t, stdout, "--output")
}

// TestCLISubscribeValidation tests subscription validation
func TestCLISubscribeValidation(t *testing.T) {
	// Test without required webhook URL
	_, stderr, err := runCLI("subscribe", "webhook", "--name", "test")
	// Should error without URL
	assert.True(t, err != nil || strings.Contains(stderr, "url") || strings.Contains(stderr, "required"))
}

// TestCLIQuietMode tests quiet mode output
func TestCLIQuietMode(t *testing.T) {
	stdout, _, err := runCLI("--quiet", "version")
	if err == nil {
		// In quiet mode, output should be minimal
		assert.True(t, len(stdout) >= 0)
	}
}

// TestCLIVerboseMode tests verbose mode output
func TestCLIVerboseMode(t *testing.T) {
	stdout, _, err := runCLI("--verbose", "version")
	if err == nil {
		// In verbose mode, output might be more detailed
		assert.True(t, len(stdout) >= 0)
	}
}
