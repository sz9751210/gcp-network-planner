package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const (
	ALGORITHM       = "aes-256-gcm"
	KEY_LENGTH      = 32
	IV_LENGTH      = 16
	AUTH_TAG_LENGTH = 16
	SALT_LENGTH    = 64
	ITERATIONS     = 100000
)

func deriveKey(encryptionKey string, salt []byte) []byte {
	return pbkdf2.Key([]byte(encryptionKey), salt, ITERATIONS, KEY_LENGTH, sha256.New)
}

func Encrypt(data string, encryptionKey string) (string, error) {
	if len(encryptionKey) != 64 {
		return "", fmt.Errorf("invalid encryption key. Must be 64-character hex string")
	}

	salt := make([]byte, SALT_LENGTH)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	iv := make([]byte, IV_LENGTH)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
	}

	key := deriveKey(encryptionKey, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	encrypted := gcm.Seal(nil, iv, []byte(data), nil)

	combined := append(salt, iv...)
	combined = append(combined, encrypted...)

	return base64.StdEncoding.EncodeToString(combined), nil
}

func Decrypt(encryptedData string, encryptionKey string) (string, error) {
	if len(encryptionKey) != 64 {
		return "", fmt.Errorf("invalid encryption key. Must be 64-character hex string")
	}

	combined, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(combined) < SALT_LENGTH+IV_LENGTH+AUTH_TAG_LENGTH {
		return "", fmt.Errorf("ciphertext too short")
	}

	salt := combined[:SALT_LENGTH]
	iv := combined[SALT_LENGTH : SALT_LENGTH+IV_LENGTH]
	encrypted := combined[SALT_LENGTH+IV_LENGTH:]

	key := deriveKey(encryptionKey, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	decrypted, err := gcm.Open(nil, iv, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(decrypted), nil
}

func IsValidEncryptionKey(key string) bool {
	if len(key) != 64 {
		return false
	}
	for _, c := range key {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
