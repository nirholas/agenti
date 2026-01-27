// Package config handles application configuration loading and validation.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/spf13/viper"
)

var configFile string

// SetConfigFile sets the config file path (used by CLI)
func SetConfigFile(path string) {
	configFile = path
}

// Config holds the complete application configuration.
type Config struct {
	Server        ServerConfig        `mapstructure:"server" validate:"required"`
	Registry      RegistryConfig      `mapstructure:"registry" validate:"required"`
	Database      DatabaseConfig      `mapstructure:"database" validate:"required"`
	Redis         RedisConfig         `mapstructure:"redis"`
	Notifications NotificationsConfig `mapstructure:"notifications" validate:"required"`
	Telemetry     TelemetryConfig     `mapstructure:"telemetry"`
	LogLevel      string              `mapstructure:"log_level"`
}

// ServerConfig holds HTTP server configuration.
type ServerConfig struct {
	Host string     `mapstructure:"host" validate:"required"`
	Port int        `mapstructure:"port" validate:"required,min=1,max=65535"`
	CORS CORSConfig `mapstructure:"cors"`
}

// CORSConfig holds CORS configuration.
type CORSConfig struct {
	Origins     []string `mapstructure:"origins"`
	Methods     []string `mapstructure:"methods"`
	Headers     []string `mapstructure:"headers"`
	Credentials bool     `mapstructure:"credentials"`
}

// RegistryConfig holds MCP Registry client configuration.
type RegistryConfig struct {
	URL           string        `mapstructure:"url" validate:"required,url"`
	PollInterval  time.Duration `mapstructure:"poll_interval" validate:"required,min=30s"`
	Timeout       time.Duration `mapstructure:"timeout" validate:"required,min=5s"`
	RetryAttempts int           `mapstructure:"retry_attempts" validate:"min=0,max=10"`
	RetryDelay    time.Duration `mapstructure:"retry_delay"`
	UserAgent     string        `mapstructure:"user_agent"`
}

// DatabaseConfig holds database configuration.
type DatabaseConfig struct {
	URL             string        `mapstructure:"url" validate:"required"`
	MaxConnections  int           `mapstructure:"max_connections" validate:"min=1,max=100"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns" validate:"min=0"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `mapstructure:"conn_max_idle_time"`
}

// RedisConfig holds Redis configuration.
type RedisConfig struct {
	URL          string        `mapstructure:"url"`
	MaxRetries   int           `mapstructure:"max_retries"`
	DialTimeout  time.Duration `mapstructure:"dial_timeout"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	PoolSize     int           `mapstructure:"pool_size"`
}

// NotificationsConfig holds notification channel configurations.
type NotificationsConfig struct {
	Discord DiscordConfig `mapstructure:"discord"`
	Slack   SlackConfig   `mapstructure:"slack"`
	Email   EmailConfig   `mapstructure:"email"`
	Webhook WebhookConfig `mapstructure:"webhook"`
	RSS     RSSConfig     `mapstructure:"rss"`
}

// DiscordConfig holds Discord notification configuration.
type DiscordConfig struct {
	Enabled       bool          `mapstructure:"enabled"`
	RateLimit     string        `mapstructure:"rate_limit"` // e.g., "30/min"
	RetryAttempts int           `mapstructure:"retry_attempts"`
	RetryDelay    time.Duration `mapstructure:"retry_delay"`
}

// SlackConfig holds Slack notification configuration.
type SlackConfig struct {
	Enabled       bool          `mapstructure:"enabled"`
	RateLimit     string        `mapstructure:"rate_limit"`
	RetryAttempts int           `mapstructure:"retry_attempts"`
	RetryDelay    time.Duration `mapstructure:"retry_delay"`
}

// EmailConfig holds email notification configuration.
type EmailConfig struct {
	Enabled       bool       `mapstructure:"enabled"`
	SMTP          SMTPConfig `mapstructure:"smtp"`
	RetryAttempts int        `mapstructure:"retry_attempts"`
	RetryDelay    time.Duration `mapstructure:"retry_delay"`
}

// SMTPConfig holds SMTP server configuration.
type SMTPConfig struct {
	Host     string `mapstructure:"host" validate:"required_if=Enabled true"`
	Port     int    `mapstructure:"port" validate:"required_if=Enabled true,min=1,max=65535"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from" validate:"required_if=Enabled true,omitempty,email"`
	TLS      bool   `mapstructure:"tls"`
}

// WebhookConfig holds generic webhook configuration.
type WebhookConfig struct {
	Enabled       bool          `mapstructure:"enabled"`
	Timeout       time.Duration `mapstructure:"timeout"`
	RetryAttempts int           `mapstructure:"retry_attempts"`
	RetryDelay    time.Duration `mapstructure:"retry_delay"`
	MaxBodySize   int64         `mapstructure:"max_body_size"` // Max response body size
}

// RSSConfig holds RSS/Atom feed configuration.
type RSSConfig struct {
	Enabled      bool   `mapstructure:"enabled"`
	ItemsPerFeed int    `mapstructure:"items_per_feed"`
	Title        string `mapstructure:"title"`
	Description  string `mapstructure:"description"`
	BaseURL      string `mapstructure:"base_url"`
}

// TelemetryConfig holds observability configuration.
type TelemetryConfig struct {
	Metrics MetricsConfig `mapstructure:"metrics"`
	Tracing TracingConfig `mapstructure:"tracing"`
}

// MetricsConfig holds Prometheus metrics configuration.
type MetricsConfig struct {
	Enabled bool `mapstructure:"enabled"`
	Port    int  `mapstructure:"port" validate:"min=1,max=65535"`
}

// TracingConfig holds distributed tracing configuration.
type TracingConfig struct {
	Enabled     bool    `mapstructure:"enabled"`
	Endpoint    string  `mapstructure:"endpoint"`
	ServiceName string  `mapstructure:"service_name"`
	SampleRate  float64 `mapstructure:"sample_rate" validate:"min=0,max=1"`
}

// Load loads configuration from file and environment variables.
func Load() (*Config, error) {
	v := viper.New()

	// Set defaults
	setDefaults(v)

	// Config file handling
	if configFile != "" {
		v.SetConfigFile(configFile)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")
		v.AddConfigPath("/app/")
		v.AddConfigPath("/etc/mcp-notify/")
		v.AddConfigPath("$HOME/.mcp-notify/")
	}

	// Environment variables
	v.SetEnvPrefix("MCP_WATCH")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Read config file (if exists)
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// Log warning but don't fail - we can use defaults and env vars
			fmt.Fprintf(os.Stderr, "Warning: config file issue: %v\n", err)
		}
		// Config file not found is okay, we'll use defaults and env vars
	}

	// Unmarshal config
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Override with environment variables for sensitive data BEFORE validation
	cfg = overrideFromEnv(cfg)

	// Validate config
	validate := validator.New()
	if err := validate.Struct(&cfg); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &cfg, nil
}

func setDefaults(v *viper.Viper) {
	// Server defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.cors.origins", []string{"*"})
	v.SetDefault("server.cors.methods", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	v.SetDefault("server.cors.headers", []string{"*"})

	// Registry defaults
	v.SetDefault("registry.url", "https://registry.modelcontextprotocol.io")
	v.SetDefault("registry.poll_interval", "5m")
	v.SetDefault("registry.timeout", "30s")
	v.SetDefault("registry.retry_attempts", 3)
	v.SetDefault("registry.retry_delay", "5s")
	v.SetDefault("registry.user_agent", "MCP-Notify/1.0")

	// Database defaults
	v.SetDefault("database.max_connections", 25)
	v.SetDefault("database.max_idle_conns", 5)
	v.SetDefault("database.conn_max_lifetime", "1h")
	v.SetDefault("database.conn_max_idle_time", "30m")

	// Redis defaults
	v.SetDefault("redis.max_retries", 3)
	v.SetDefault("redis.dial_timeout", "5s")
	v.SetDefault("redis.read_timeout", "3s")
	v.SetDefault("redis.write_timeout", "3s")
	v.SetDefault("redis.pool_size", 10)

	// Notification defaults
	v.SetDefault("notifications.discord.enabled", true)
	v.SetDefault("notifications.discord.rate_limit", "30/min")
	v.SetDefault("notifications.discord.retry_attempts", 3)
	v.SetDefault("notifications.discord.retry_delay", "1s")

	v.SetDefault("notifications.slack.enabled", true)
	v.SetDefault("notifications.slack.rate_limit", "30/min")
	v.SetDefault("notifications.slack.retry_attempts", 3)
	v.SetDefault("notifications.slack.retry_delay", "1s")

	v.SetDefault("notifications.email.enabled", true)
	v.SetDefault("notifications.email.retry_attempts", 3)
	v.SetDefault("notifications.email.retry_delay", "5s")
	v.SetDefault("notifications.email.smtp.port", 587)
	v.SetDefault("notifications.email.smtp.tls", true)

	v.SetDefault("notifications.webhook.enabled", true)
	v.SetDefault("notifications.webhook.timeout", "10s")
	v.SetDefault("notifications.webhook.retry_attempts", 3)
	v.SetDefault("notifications.webhook.retry_delay", "2s")
	v.SetDefault("notifications.webhook.max_body_size", 1048576) // 1MB

	v.SetDefault("notifications.rss.enabled", true)
	v.SetDefault("notifications.rss.items_per_feed", 100)
	v.SetDefault("notifications.rss.title", "MCP Registry Changes")
	v.SetDefault("notifications.rss.description", "Recent changes in the MCP Registry")

	// Telemetry defaults
	v.SetDefault("telemetry.metrics.enabled", true)
	v.SetDefault("telemetry.metrics.port", 9090)
	v.SetDefault("telemetry.tracing.enabled", false)
	v.SetDefault("telemetry.tracing.service_name", "mcp-notify")
	v.SetDefault("telemetry.tracing.sample_rate", 0.1)

	// Log level default
	v.SetDefault("log_level", "info")
}

func overrideFromEnv(cfg Config) Config {
	// Override database URL from env (for sensitive credentials)
	// Support both MCP_WATCH_DATABASE_URL and DATABASE_URL (Railway/Heroku style)
	if url := os.Getenv("MCP_WATCH_DATABASE_URL"); url != "" {
		cfg.Database.URL = url
	} else if url := os.Getenv("DATABASE_URL"); url != "" {
		cfg.Database.URL = url
	}

	// Override Redis URL from env
	// Support both MCP_WATCH_REDIS_URL and REDIS_URL (Railway/Heroku style)
	if url := os.Getenv("MCP_WATCH_REDIS_URL"); url != "" {
		cfg.Redis.URL = url
	} else if url := os.Getenv("REDIS_URL"); url != "" {
		cfg.Redis.URL = url
	}

	// Override server port from Railway's PORT env var
	if port := os.Getenv("PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			cfg.Server.Port = p
		}
	}

	// Override SMTP password from env
	if password := os.Getenv("MCP_WATCH_SMTP_PASSWORD"); password != "" {
		cfg.Notifications.Email.SMTP.Password = password
	}

	return cfg
}
