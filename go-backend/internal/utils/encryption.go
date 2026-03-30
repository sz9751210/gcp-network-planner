package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

type Encryption struct {
	key              []byte
	legacyNodeSecret []byte
}

func NewEncryption(encryptionKey string) *Encryption {
	if len(encryptionKey) != 64 {
		panic(fmt.Sprintf("Invalid ENCRYPTION_KEY: must be 64 characters, got %d", len(encryptionKey)))
	}

	key, err := hexToBytes(encryptionKey)
	if err != nil {
		panic(fmt.Sprintf("Invalid ENCRYPTION_KEY: %v", err))
	}

	return &Encryption{
		key:              key,
		legacyNodeSecret: []byte(encryptionKey),
	}
}

const (
	algorithm  = "aes-256-gcm"
	keyLength  = 32
	iterations = 100000

	currentVersionPrefix = "v2:"
	currentSaltLength    = 16
	currentNonceLength   = 12

	nodeLegacySaltLength = 64
	nodeLegacyIVLength   = 16
	nodeLegacyTagLength  = 16
)

func (e *Encryption) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", errors.New("plaintext cannot be empty")
	}

	salt := make([]byte, currentSaltLength)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	nonce := make([]byte, currentNonceLength)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	key := e.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	ciphertext := aesgcm.Seal(nil, nonce, []byte(plaintext), nil)

	combined := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	combined = append(combined, salt...)
	combined = append(combined, nonce...)
	combined = append(combined, ciphertext...)

	return currentVersionPrefix + base64.StdEncoding.EncodeToString(combined), nil
}

func (e *Encryption) Decrypt(encryptedData string) (string, error) {
	if encryptedData == "" {
		return "", errors.New("encrypted data cannot be empty")
	}

	if strings.HasPrefix(encryptedData, currentVersionPrefix) {
		return e.decryptCurrent(encryptedData)
	}

	// Legacy compatibility: Node.js format.
	if legacy, err := e.decryptNodeLegacy(encryptedData); err == nil {
		return legacy, nil
	}

	// Backward compatibility fallback: old Go payload without version prefix
	// used the same payload layout as v2 (salt+nonce+ciphertextWithTag).
	return e.decryptCurrent(currentVersionPrefix + encryptedData)
}

func (e *Encryption) decryptCurrent(versionedCiphertext string) (string, error) {
	raw := strings.TrimPrefix(versionedCiphertext, currentVersionPrefix)

	combined, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(combined) < currentSaltLength+currentNonceLength {
		return "", errors.New("encrypted data too short")
	}

	salt := combined[:currentSaltLength]
	nonce := combined[currentSaltLength : currentSaltLength+currentNonceLength]
	ciphertext := combined[currentSaltLength+currentNonceLength:]

	if len(ciphertext) == 0 {
		return "", errors.New("encrypted payload missing ciphertext")
	}

	key := e.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := aesgcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

func (e *Encryption) deriveKey(salt []byte) []byte {
	return pbkdf2.Key(e.key, salt, iterations, keyLength, sha256.New)
}

func IsValidEncryptionKey(key string) bool {
	if len(key) != 64 {
		return false
	}
	_, err := hexToBytes(key)
	return err == nil
}

func hexToBytes(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		return nil, errors.New("hex string must have even length")
	}

	result := make([]byte, len(s)/2)
	for i := 0; i < len(s)/2; i++ {
		high, err := hexCharToNibble(s[2*i])
		if err != nil {
			return nil, err
		}
		low, err := hexCharToNibble(s[2*i+1])
		if err != nil {
			return nil, err
		}

		if high < 0 || low < 0 {
			return nil, errors.New("invalid hex character")
		}
		result[i] = (byte(high) << 4) | byte(low)
	}

	return result, nil
}

func hexCharToNibble(c byte) (int, error) {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0'), nil
	case c >= 'a' && c <= 'f':
		return int(c - 'a' + 10), nil
	case c >= 'A' && c <= 'F':
		return int(c - 'A' + 10), nil
	default:
		return 0, errors.New("invalid hex character")
	}
}

func hexCharToNibbleSimple(c byte) int {
	if c >= '0' && c <= '9' {
		return int(c - '0')
	}
	if c >= 'a' && c <= 'f' {
		return int(c - 'a' + 10)
	}
	if c >= 'A' && c <= 'F' {
		return int(c - 'A' + 10)
	}
	return -1
}

func (e *Encryption) decryptNodeLegacy(encryptedData string) (string, error) {
	combined, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode legacy payload: %w", err)
	}

	if len(combined) < nodeLegacySaltLength+nodeLegacyIVLength+nodeLegacyTagLength {
		return "", errors.New("legacy payload too short")
	}

	salt := combined[:nodeLegacySaltLength]
	iv := combined[nodeLegacySaltLength : nodeLegacySaltLength+nodeLegacyIVLength]
	authTag := combined[nodeLegacySaltLength+nodeLegacyIVLength : nodeLegacySaltLength+nodeLegacyIVLength+nodeLegacyTagLength]
	ciphertext := combined[nodeLegacySaltLength+nodeLegacyIVLength+nodeLegacyTagLength:]

	key := pbkdf2.Key(e.legacyNodeSecret, salt, iterations, keyLength, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create legacy cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCMWithNonceSize(block, nodeLegacyIVLength)
	if err != nil {
		return "", fmt.Errorf("failed to create legacy GCM: %w", err)
	}

	payload := append(ciphertext, authTag...)
	plaintext, err := aesgcm.Open(nil, iv, payload, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt legacy payload: %w", err)
	}

	return string(plaintext), nil
}
