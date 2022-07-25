package remotemonitor

import (
	"errors"
	"fmt"
	"net/url"
)

// Config contains all necessary values for remote monitoring.
type Config struct {
	// Location is the unique location name of this monitor.
	Location string

	// PublicURL is the publicly-routable base URL for this monitor.
	// It must match what is configured for twilio SMS.
	PublicURL string

	// ListenAddr is the address and port to bind to.
	ListenAddr string

	// CheckMinutes denotes the number of minutes between checks (for all instances).
	CheckMinutes int

	Twilio struct {
		AccountSID string
		AuthToken  string
		FromNumber string
	}

	SMTP struct {
		Address    string
		User, Pass string
	}

	// Instances determine what remote GoAlert instances will be monitored and send potential errors.
	Instances []Instance
}

func (cfg Config) Validate() error {
	if cfg.Location == "" {
		return errors.New("location is required")
	}
	if cfg.PublicURL == "" {
		return errors.New("public URL is required")
	}
	_, err := url.Parse(cfg.PublicURL)
	if err != nil {
		return fmt.Errorf("parse public URL: %v", err)
	}

	if cfg.ListenAddr == "" {
		return errors.New("listen address is required")
	}

	if cfg.CheckMinutes < 1 {
		return errors.New("check minutes is required")
	}

	if cfg.Twilio.AccountSID == "" {
		return errors.New("twilio account SID is required")
	}
	if cfg.Twilio.AuthToken == "" {
		return errors.New("twilio auth token is required")
	}
	if cfg.Twilio.FromNumber == "" {
		return errors.New("twilio from number is required")
	}

	for idx, i := range cfg.Instances {
		if err := i.Validate(); err != nil {
			return fmt.Errorf("instance[%d] %q: %v", idx, i.Location, err)
		}
	}

	return nil
}
