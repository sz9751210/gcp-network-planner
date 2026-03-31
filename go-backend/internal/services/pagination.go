package services

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

func encodeCursor(timestamp time.Time, id string) string {
	payload := fmt.Sprintf("%d|%s", timestamp.UTC().UnixNano(), id)
	return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func decodeCursor(raw string) (*time.Time, string, error) {
	cursor := strings.TrimSpace(raw)
	if cursor == "" {
		return nil, "", nil
	}

	decoded, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return nil, "", errors.New("invalid cursor encoding")
	}

	parts := strings.SplitN(string(decoded), "|", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
		return nil, "", errors.New("invalid cursor payload")
	}

	nanos, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return nil, "", errors.New("invalid cursor timestamp")
	}

	ts := time.Unix(0, nanos).UTC()
	return &ts, parts[1], nil
}
