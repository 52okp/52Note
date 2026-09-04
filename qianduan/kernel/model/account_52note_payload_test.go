package model

import (
	"encoding/json"
	"os"
	"reflect"
	"sort"
	"testing"
)

func TestAccountPayloadContract(t *testing.T) {
	cases := []struct {
		endpoint string
		payload  any
		keys     []string
	}{
		{"/api/v1/auth/register", account52NotePayload(" user@example.com ", " password ", " Name "), []string{"email", "password", "display_name", "device_name", "platform"}},
		{"/api/v1/auth/login", account52NotePayload(" user@example.com ", " password ", ""), []string{"email", "password", "display_name", "device_name", "platform"}},
		{"/api/v1/auth/register/verify", account52NoteCodePayload(" user@example.com ", " 123456 "), []string{"email", "code", "device_name", "platform"}},
		{"/api/v1/auth/login-code/confirm", account52NoteCodePayload(" user@example.com ", " 123456 "), []string{"email", "code", "device_name", "platform"}},
		{"/api/v1/auth/login-code/request", account52NoteEmailPayload(" user@example.com "), []string{"email"}},
	}
	fixtures := map[string]json.RawMessage{}
	for _, tc := range cases {
		t.Run(tc.endpoint, func(t *testing.T) {
			body, err := json.Marshal(tc.payload)
			if err != nil {
				t.Fatal(err)
			}
			var decoded map[string]string
			if err = json.Unmarshal(body, &decoded); err != nil {
				t.Fatal(err)
			}
			var keys []string
			for key := range decoded {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			sort.Strings(tc.keys)
			if !reflect.DeepEqual(keys, tc.keys) {
				t.Fatalf("keys %v, want %v", keys, tc.keys)
			}
			if decoded["email"] != "user@example.com" {
				t.Fatal("email whitespace not trimmed")
			}
			if password, ok := decoded["password"]; ok && password != " password " {
				t.Fatal("password was trimmed")
			}
			if code, ok := decoded["code"]; ok && code != "123456" {
				t.Fatal("code was not trimmed")
			}
			if device, ok := decoded["device_name"]; ok && device == "" {
				t.Fatal("device is empty")
			}
			fixtures[tc.endpoint] = body
		})
	}
	if t.Failed() {
		return
	}
	if target := os.Getenv("C1_PAYLOAD_FIXTURE"); target != "" {
		body, err := json.Marshal(fixtures)
		if err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(target, body, 0600); err != nil {
			t.Fatal(err)
		}
	}
}
