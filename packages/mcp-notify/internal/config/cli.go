// Package config handles CLI configuration file support.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// CLIConfig holds CLI-specific configuration.
type CLIConfig struct {
	// API settings
	APIEndpoint string `yaml:"api_endpoint"`
	APIKey      string `yaml:"api_key"`

	// Output preferences
	DefaultOutput string `yaml:"default_output"` // table, json, yaml
	NoColor       bool   `yaml:"no_color"`

	// Registry settings (for direct mode)
	RegistryURL string `yaml:"registry_url"`

	// Saved subscriptions (name -> ID mapping for convenience)
	Subscriptions map[string]string `yaml:"subscriptions"`

	// Watch preferences
	DefaultWatchInterval string `yaml:"default_watch_interval"`
}

// DefaultCLIConfig returns default CLI configuration.
func DefaultCLIConfig() *CLIConfig {
	return &CLIConfig{
		APIEndpoint:          "http://localhost:8080",
		DefaultOutput:        "table",
		NoColor:              false,
		RegistryURL:          "https://registry.modelcontextprotocol.io",
		Subscriptions:        make(map[string]string),
		DefaultWatchInterval: "1m",
	}
}

// GetCLIConfigPath returns the path to the CLI config file.
func GetCLIConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	return filepath.Join(homeDir, ".mcp-notify", "config.yaml"), nil
}

// LoadCLIConfig loads the CLI configuration from the default location.
func LoadCLIConfig() (*CLIConfig, error) {
	configPath, err := GetCLIConfigPath()
	if err != nil {
		return nil, err
	}
	return LoadCLIConfigFrom(configPath)
}

// LoadCLIConfigFrom loads CLI configuration from a specific path.
func LoadCLIConfigFrom(path string) (*CLIConfig, error) {
	cfg := DefaultCLIConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return defaults if config doesn't exist
			return cfg, nil
		}
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Ensure subscriptions map is initialized
	if cfg.Subscriptions == nil {
		cfg.Subscriptions = make(map[string]string)
	}

	return cfg, nil
}

// SaveCLIConfig saves the CLI configuration to the default location.
func SaveCLIConfig(cfg *CLIConfig) error {
	configPath, err := GetCLIConfigPath()
	if err != nil {
		return err
	}
	return SaveCLIConfigTo(cfg, configPath)
}

// SaveCLIConfigTo saves CLI configuration to a specific path.
func SaveCLIConfigTo(cfg *CLIConfig, path string) error {
	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write with secure permissions (owner read/write only)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// SaveSubscription saves a subscription mapping to the config.
func (c *CLIConfig) SaveSubscription(name, id string) error {
	if c.Subscriptions == nil {
		c.Subscriptions = make(map[string]string)
	}
	c.Subscriptions[name] = id
	return SaveCLIConfig(c)
}

// GetSubscriptionID looks up a subscription ID by name.
func (c *CLIConfig) GetSubscriptionID(nameOrID string) string {
	// First check if it's a saved name
	if id, ok := c.Subscriptions[nameOrID]; ok {
		return id
	}
	// Otherwise assume it's an ID
	return nameOrID
}

// RemoveSubscription removes a subscription from the saved mappings.
func (c *CLIConfig) RemoveSubscription(name string) error {
	if c.Subscriptions == nil {
		return nil
	}
	delete(c.Subscriptions, name)
	return SaveCLIConfig(c)
}
