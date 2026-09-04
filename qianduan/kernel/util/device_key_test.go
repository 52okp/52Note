package util

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
)

func TestDeviceKeyProcess(t *testing.T) {
	filename := os.Getenv("DEVICE_KEY_TEST_PATH")
	if filename == "" {
		return
	}
	key, err := readOrCreateDeviceKey(filename)
	if err != nil || len(key) != 32 {
		t.Fatal(err)
	}
}
func TestDeviceKeyConcurrentProcesses(t *testing.T) {
	filename := filepath.Join(t.TempDir(), "device.key")
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cmd := exec.Command(os.Args[0], "-test.run=^TestDeviceKeyProcess$")
			cmd.Env = append(os.Environ(), "DEVICE_KEY_TEST_PATH="+filename)
			if out, err := cmd.CombinedOutput(); err != nil {
				t.Errorf("%v %s", err, out)
			}
		}()
	}
	wg.Wait()
	first, err := readOrCreateDeviceKey(filename)
	if err != nil {
		t.Fatal(err)
	}
	again, err := readOrCreateDeviceKey(filename)
	if err != nil || !bytes.Equal(first, again) {
		t.Fatal("key changed")
	}
}
func TestDeviceKeyCorruptionPreserved(t *testing.T) {
	filename := filepath.Join(t.TempDir(), "device.key")
	bad := []byte("corrupt")
	if err := os.WriteFile(filename, bad, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := readOrCreateDeviceKey(filename); err == nil {
		t.Fatal("corrupt key accepted")
	}
	got, _ := os.ReadFile(filename)
	if !bytes.Equal(got, bad) {
		t.Fatal("existing key replaced")
	}
}
