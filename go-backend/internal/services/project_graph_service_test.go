package services

import (
	"reflect"
	"testing"
)

func TestParseJSONStringArray(t *testing.T) {
	got := parseJSONStringArray(`["10.0.0.0/8","192.168.0.0/16"]`)
	want := []string{"10.0.0.0/8", "192.168.0.0/16"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected array: %#v", got)
	}

	invalid := parseJSONStringArray(`not-json`)
	if len(invalid) != 0 {
		t.Fatalf("expected empty array for invalid payload, got %#v", invalid)
	}
}

func TestParseFirewallPorts(t *testing.T) {
	raw := `[{"IPProtocol":"tcp","ports":["22","443"]},{"IPProtocol":"udp"}]`
	got := parseFirewallPorts(raw)
	if len(got) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(got))
	}
	if got[0].IPProtocol != "tcp" || len(got[0].Ports) != 2 {
		t.Fatalf("unexpected first firewall port: %#v", got[0])
	}
	if got[1].IPProtocol != "udp" {
		t.Fatalf("unexpected second firewall port: %#v", got[1])
	}
}

func TestNormalizeLoadBalancerType(t *testing.T) {
	if normalizeLoadBalancerType("EXTERNAL", "TCP") != "EXTERNAL_TCP" {
		t.Fatalf("expected EXTERNAL_TCP")
	}
	if normalizeLoadBalancerType("EXTERNAL", "HTTPS") != "EXTERNAL_HTTPS" {
		t.Fatalf("expected EXTERNAL_HTTPS")
	}
	if normalizeLoadBalancerType("INTERNAL", "TCP") != "INTERNAL_TCP" {
		t.Fatalf("expected INTERNAL_TCP")
	}
	if normalizeLoadBalancerType("INTERNAL", "HTTP") != "INTERNAL_HTTP" {
		t.Fatalf("expected INTERNAL_HTTP")
	}
}
