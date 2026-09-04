package util

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/gofrs/flock"
	"os"
	"path/filepath"
	"strings"
)

func readOrCreateDeviceKey(path string) ([]byte, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	lock := flock.New(path + ".lock")
	if err := lock.Lock(); err != nil {
		return nil, err
	}
	defer lock.Unlock()
	data, err := os.ReadFile(path)
	if err == nil {
		key, decodeErr := hex.DecodeString(strings.TrimSpace(string(data)))
		if decodeErr != nil || len(key) != 32 {
			return nil, fmt.Errorf("invalid device key; restore the original key instead of regenerating it")
		}
		return key, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	key := make([]byte, 32)
	if _, err = rand.Read(key); err != nil {
		return nil, err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".device-key-*")
	if err != nil {
		return nil, err
	}
	defer os.Remove(temporary.Name())
	if err = temporary.Chmod(0600); err == nil {
		_, err = temporary.WriteString(hex.EncodeToString(key))
	}
	if err == nil {
		err = temporary.Sync()
	}
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return nil, err
	}
	if err = os.Rename(temporary.Name(), path); err != nil {
		return nil, err
	}
	return key, nil
}

func readDeviceKey(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	key, err := hex.DecodeString(strings.TrimSpace(string(data)))
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("invalid device key")
	}
	return key, nil
}
