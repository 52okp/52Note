package model

import (
	"os"
	"runtime"
	"strings"
)

type noteCredentialsPayload struct {
	Email       string `json:"email"`
	Password    string `json:"password,omitempty"`
	DisplayName string `json:"display_name"`
	DeviceName  string `json:"device_name"`
	Platform    string `json:"platform"`
}

type noteCodePayload struct {
	Email      string `json:"email"`
	Code       string `json:"code"`
	DeviceName string `json:"device_name"`
	Platform   string `json:"platform"`
}

type noteEmailPayload struct {
	Email string `json:"email"`
}

func account52NotePayload(email, password, displayName string) noteCredentialsPayload {
	return noteCredentialsPayload{Email: strings.TrimSpace(email), Password: password, DisplayName: strings.TrimSpace(displayName), DeviceName: account52NoteDeviceName(), Platform: account52NotePlatform()}
}
func account52NoteCodePayload(email, code string) noteCodePayload {
	return noteCodePayload{Email: strings.TrimSpace(email), Code: strings.TrimSpace(code), DeviceName: account52NoteDeviceName(), Platform: account52NotePlatform()}
}
func account52NoteEmailPayload(email string) noteEmailPayload {
	return noteEmailPayload{Email: strings.TrimSpace(email)}
}
func account52NoteDeviceName() string {
	hostname, _ := os.Hostname()
	if strings.TrimSpace(hostname) == "" {
		return "52Note"
	}
	return hostname
}
func account52NotePlatform() string {
	switch runtime.GOOS {
	case "darwin":
		return "macos"
	case "windows", "android", "ios", "linux":
		return runtime.GOOS
	default:
		return "other"
	}
}
