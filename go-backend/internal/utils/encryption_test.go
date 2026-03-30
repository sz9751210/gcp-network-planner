package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"golang.org/x/crypto/pbkdf2"
)

func TestEncryptDecryptCurrentVersion(t *testing.T) {
	key := "936f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946"
	enc := NewEncryption(key)

	ciphertext, err := enc.Encrypt("hello-encryption")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if !strings.HasPrefix(ciphertext, currentVersionPrefix) {
		t.Fatalf("expected prefix %q, got %q", currentVersionPrefix, ciphertext)
	}

	plaintext, err := enc.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if plaintext != "hello-encryption" {
		t.Fatalf("unexpected plaintext: %q", plaintext)
	}
}

func TestDecryptNodeLegacyPayload(t *testing.T) {
	key := "936f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946"
	legacyPayload, err := encryptNodeLegacyForTest(key, "legacy-node-format")
	if err != nil {
		t.Fatalf("failed to produce legacy payload: %v", err)
	}

	enc := NewEncryption(key)
	plaintext, err := enc.Decrypt(legacyPayload)
	if err != nil {
		t.Fatalf("Decrypt legacy payload failed: %v", err)
	}

	if plaintext != "legacy-node-format" {
		t.Fatalf("unexpected plaintext: %q", plaintext)
	}
}

func TestDecryptUnversionedCurrentPayloadFallback(t *testing.T) {
	key := "936f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946"
	enc := NewEncryption(key)

	ciphertext, err := enc.Encrypt("fallback-current")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	unversioned := strings.TrimPrefix(ciphertext, currentVersionPrefix)
	plaintext, err := enc.Decrypt(unversioned)
	if err != nil {
		t.Fatalf("Decrypt fallback payload failed: %v", err)
	}

	if plaintext != "fallback-current" {
		t.Fatalf("unexpected plaintext: %q", plaintext)
	}
}

func TestDecryptWithWrongKeyFails(t *testing.T) {
	keyA := "936f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946"
	keyB := "836f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946"

	encA := NewEncryption(keyA)
	encB := NewEncryption(keyB)

	ciphertext, err := encA.Encrypt("secret-value")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if _, err := encB.Decrypt(ciphertext); err == nil {
		t.Fatalf("expected decrypt with wrong key to fail")
	}
}

func TestDecryptCorruptedPayloadFails(t *testing.T) {
	key := "936f2425316f73a12b9870492aef6733b9504147ef113a902065a59de4b0e946"
	enc := NewEncryption(key)

	ciphertext, err := enc.Encrypt("corrupt-me")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	corrupted := ciphertext[:len(ciphertext)-2] + "xx"
	if _, err := enc.Decrypt(corrupted); err == nil {
		t.Fatalf("expected decrypt with corrupted payload to fail")
	}
}

func encryptNodeLegacyForTest(encryptionKey string, plaintext string) (string, error) {
	salt := make([]byte, nodeLegacySaltLength)
	iv := make([]byte, nodeLegacyIVLength)
	for i := range salt {
		salt[i] = byte((i * 13) % 256)
	}
	for i := range iv {
		iv[i] = byte((i * 7) % 256)
	}

	key := pbkdf2.Key([]byte(encryptionKey), salt, iterations, keyLength, sha256.New)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCMWithNonceSize(block, nodeLegacyIVLength)
	if err != nil {
		return "", err
	}

	sealed := aesgcm.Seal(nil, iv, []byte(plaintext), nil)
	tagIndex := len(sealed) - nodeLegacyTagLength
	ciphertext := sealed[:tagIndex]
	authTag := sealed[tagIndex:]

	combined := append([]byte{}, salt...)
	combined = append(combined, iv...)
	combined = append(combined, authTag...)
	combined = append(combined, ciphertext...)

	return base64.StdEncoding.EncodeToString(combined), nil
}
