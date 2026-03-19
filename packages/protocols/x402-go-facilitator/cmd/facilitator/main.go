package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gosuda/x402-facilitator/api"
	"github.com/gosuda/x402-facilitator/facilitator"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:   "x402-facilitator",
	Short: "Start the facilitator server",
	Run: func(cmd *cobra.Command, args []string) {
		run()
	},
}

var (
	configPath string
)

func init() {
	cmd.PersistentFlags().StringVarP(&configPath, "config", "c", "config.toml", "Path to the configuration file")
}

func main() {
	if err := cmd.Execute(); err != nil {
		log.Fatal().Err(err).Msg("Failed to execute command")
	}
}

func run() {
	config, err := LoadConfig(configPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration, shutting down...")
	}
	log.Logger = zerolog.New(os.Stdout).With().Timestamp().Caller().Logger()

	facilitator, err := facilitator.NewFacilitator(config.Scheme, config.Network, config.Url, config.PrivateKey)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to init facilitator, shutting down...")
	}

	api := api.NewServer(facilitator)

	// Initialize Server
	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: api,
	}

	go func() {
		log.Info().Msgf("Starting server on port %d", config.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Failed to start server, shutting down...")
		}
	}()

	// Graceful shutdown handling
	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to shutdown server gracefully")
	}
	log.Info().Msg("Server shutdown gracefully")
}
