package conf

import (
	"reflect"
	"testing"
)

func TestRetiredProviderMigration(t *testing.T) {
	s := NewSync()
	s.Provider = ProviderSiYuan
	s.Enabled = true
	s.Perception = true
	s.CloudName = "custom"
	s.S3 = &S3{Endpoint: "https://s3.example", Bucket: "notes"}
	s.NormalizeProvider()
	if s.Provider != ProviderS3 || s.Enabled || s.Perception || s.CloudName != "custom" || s.S3.Bucket != "notes" {
		t.Fatalf("unexpected migration: %+v", s)
	}
}
func TestThirdPartySyncConfigurationPreserved(t *testing.T) {
	for _, provider := range []int{ProviderS3, ProviderWebDAV, ProviderLocal} {
		s := NewSync()
		s.Provider = provider
		s.Enabled = true
		s.CloudName = "custom"
		s.LAN.Enabled = true
		before := *s
		s.NormalizeProvider()
		if !reflect.DeepEqual(before, *s) || !IsSupportedSyncProvider(provider) {
			t.Fatalf("provider %d modified", provider)
		}
	}
	if IsSupportedSyncProvider(ProviderSiYuan) || IsSupportedSyncProvider(-1) {
		t.Fatal("unsupported provider accepted")
	}
}
