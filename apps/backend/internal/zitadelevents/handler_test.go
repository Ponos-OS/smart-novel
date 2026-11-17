package zitadelevents

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"testing"
	"time"
)

const (
	signingKey = "whsec-Qp3vN8cT5yZ1mLk7"
	body       = `{"aggregateID":"399193312042418199"}`
)

func signed(key string, at time.Time) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(strconv.FormatInt(at.Unix(), 10) + "." + body))

	return fmt.Sprintf(
		"t=%d,v1=%s",
		at.Unix(),
		hex.EncodeToString(mac.Sum(nil)),
	)
}

func TestVerify(t *testing.T) {
	now := time.Date(2026, 11, 15, 20, 0, 0, 0, time.UTC)
	cases := map[string]struct {
		header string
		body   string
		want   error
	}{
		"a signature of the body": {signed(signingKey, now), body, nil},
		"a call a minute ago": {
			signed(signingKey, now.Add(-time.Minute)),
			body,
			nil,
		},
		"another key": {
			signed("whsec-other", now),
			body,
			errBadSignature,
		},
		"a body that was changed": {
			signed(signingKey, now),
			`{"aggregateID":"1"}`,
			errBadSignature,
		},
		"a call ten minutes ago": {
			signed(signingKey, now.Add(-10*time.Minute)),
			body,
			errStaleSignature,
		},
		"a call ten minutes from now": {
			signed(signingKey, now.Add(10*time.Minute)),
			body,
			errStaleSignature,
		},
		"no header": {"", body, errMissingSignature},
		"a header without a signature": {
			"t=1763236800",
			body,
			errMissingSignature,
		},
		"a signature that is not hex": {
			"t=1763236800,v1=zz",
			body,
			errMissingSignature,
		},
	}
	for name, test := range cases {
		t.Run(name, func(t *testing.T) {
			err := verify(signingKey, test.header, []byte(test.body), now)

			if !errors.Is(err, test.want) {
				t.Errorf("got %v, want %v", err, test.want)
			}
		})
	}
}
