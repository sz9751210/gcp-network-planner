package services

import (
	"errors"
	"reflect"
	"testing"

	compute "google.golang.org/api/compute/v1"
)

func TestCollectBackendServiceRefsFromURLMap(t *testing.T) {
	urlMap := &compute.UrlMap{
		DefaultService: "global/backendServices/default-backend",
		DefaultRouteAction: &compute.HttpRouteAction{
			WeightedBackendServices: []*compute.WeightedBackendService{
				{BackendService: "global/backendServices/default-weighted"},
			},
		},
		PathMatchers: []*compute.PathMatcher{
			{
				DefaultService: "regions/us-central1/backendServices/path-default",
				PathRules: []*compute.PathRule{
					{
						Service: "global/backendServices/path-service",
						RouteAction: &compute.HttpRouteAction{
							WeightedBackendServices: []*compute.WeightedBackendService{
								{BackendService: "global/backendServices/path-weighted"},
								{BackendService: "global/backendServices/path-weighted"},
							},
						},
					},
				},
				RouteRules: []*compute.HttpRouteRule{
					{
						Service: "global/backendServices/route-service",
						RouteAction: &compute.HttpRouteAction{
							WeightedBackendServices: []*compute.WeightedBackendService{
								{BackendService: "global/backendServices/route-weight-a"},
								{BackendService: "global/backendServices/route-weight-b"},
							},
						},
					},
				},
			},
		},
	}

	got := collectBackendServiceRefsFromURLMap(urlMap)
	want := []string{
		"global/backendServices/default-backend",
		"global/backendServices/default-weighted",
		"regions/us-central1/backendServices/path-default",
		"global/backendServices/path-service",
		"global/backendServices/path-weighted",
		"global/backendServices/route-service",
		"global/backendServices/route-weight-a",
		"global/backendServices/route-weight-b",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected backend refs: %#v", got)
	}
}

func TestResolveForwardingRuleBackendRefsCombinesDirectAndTarget(t *testing.T) {
	resolver := &lbResourceResolver{
		targetBackendCache: map[string][]string{
			"global/targetHttpProxies/web-proxy": {"global/backendServices/url-map-be"},
		},
	}

	refs := resolver.resolveForwardingRuleBackendRefs(&compute.ForwardingRule{
		BackendService: "global/backendServices/direct-be",
		Target:         "global/targetHttpProxies/web-proxy",
	})

	want := []string{
		"global/backendServices/direct-be",
		"global/backendServices/url-map-be",
	}
	if !reflect.DeepEqual(refs, want) {
		t.Fatalf("unexpected forwarding rule refs: %#v", refs)
	}
}

func TestResolveBackendSecurityPoliciesHandlesPartialLookupErrors(t *testing.T) {
	resolver := &lbResourceResolver{
		backendSecurityPolicyCache: map[string]lbResolvedBackendPolicies{
			"global/backendServices/backend-a": {
				policies: []string{"armor-a", "edge-a"},
			},
			"global/backendServices/backend-b": {
				policies: make([]string, 0),
				err:      errors.New("permission denied"),
			},
		},
	}

	backendPolicies, cloudArmorPolicies, backendUnavailable := resolver.resolveBackendSecurityPolicies([]string{
		"global/backendServices/backend-a",
		"global/backendServices/backend-b",
	})

	if !reflect.DeepEqual(backendPolicies["backend-a"], []string{"armor-a", "edge-a"}) {
		t.Fatalf("unexpected backend-a policies: %#v", backendPolicies["backend-a"])
	}
	if len(backendPolicies["backend-b"]) != 0 {
		t.Fatalf("expected backend-b to be empty on lookup error: %#v", backendPolicies["backend-b"])
	}
	if !reflect.DeepEqual(cloudArmorPolicies, []string{"armor-a", "edge-a"}) {
		t.Fatalf("unexpected cloud armor aggregation: %#v", cloudArmorPolicies)
	}
	if backendUnavailable["backend-a"] {
		t.Fatalf("expected backend-a to be available")
	}
	if !backendUnavailable["backend-b"] {
		t.Fatalf("expected backend-b to be unavailable")
	}
}

func TestParseComputeResourceRef(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want computeResourceRef
	}{
		{
			name: "global full url",
			raw:  "https://www.googleapis.com/compute/v1/projects/p/global/backendServices/be-a",
			want: computeResourceRef{project: "p", collection: "backendServices", name: "be-a"},
		},
		{
			name: "regional partial path",
			raw:  "regions/us-central1/backendServices/be-r",
			want: computeResourceRef{collection: "backendServices", region: "us-central1", name: "be-r"},
		},
		{
			name: "regional full url",
			raw:  "https://www.googleapis.com/compute/v1/projects/p2/regions/asia-east1/backendServices/be-r2",
			want: computeResourceRef{project: "p2", collection: "backendServices", region: "asia-east1", name: "be-r2"},
		},
		{
			name: "name only",
			raw:  "backend-plain",
			want: computeResourceRef{name: "backend-plain"},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := parseComputeResourceRef(tc.raw)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("unexpected parse result: %#v", got)
			}
		})
	}
}

func TestNormalizeAggregatedLocationKey(t *testing.T) {
	if normalizeAggregatedLocationKey("regions/us-central1") != "us-central1" {
		t.Fatalf("expected regional key to normalize to region name")
	}
	if normalizeAggregatedLocationKey("global") != "global" {
		t.Fatalf("expected global key to stay global")
	}
	if normalizeAggregatedLocationKey("") != "global" {
		t.Fatalf("expected empty key to fallback to global")
	}
}
