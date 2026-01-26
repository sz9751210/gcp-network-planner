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
)

type Encryption struct {
	key []byte
}

func NewEncryption(encryptionKey string) *Encryption {
	if len(encryptionKey) != 64 {
		panic(fmt.Sprintf("Invalid ENCRYPTION_KEY: must be 64 characters, got %d", len(encryptionKey)))
	}

	key, err := hexToBytes(encryptionKey)
	if err != nil {
		panic(fmt.Sprintf("Invalid ENCRYPTION_KEY: %v", err))
	}

	return &Encryption{key: key}
}

const (
	algorithm     = "aes-256-gcm"
	keyLength     = 32
	ivLength      = 12
	authTagLength = 16
	saltLength    = 64
	iterations    = 100000
)

func (e *Encryption) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", errors.New("plaintext cannot be empty")
	}

	salt := make([]byte, saltLength)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	iv := make([]byte, ivLength)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
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

	ciphertext := aesgcm.Seal(nil, iv, []byte(plaintext), nil)

	combined := make([]byte, 0, len(salt)+len(iv)+len(ciphertext))
	combined = append(combined, salt...)
	combined = append(combined, iv...)
	combined = append(combined, ciphertext...)

	return base64.StdEncoding.EncodeToString(combined), nil
}

func (e *Encryption) Decrypt(encryptedData string) (string, error) {
	if encryptedData == "" {
		return "", errors.New("encrypted data cannot be empty")
	}

	combined, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(combined) < saltLength+ivLength+authTagLength {
		return "", errors.New("encrypted data too short")
	}

	salt := combined[:saltLength]
	iv := combined[saltLength : saltLength+ivLength]
	authTag := combined[saltLength+ivLength : saltLength+ivLength+authTagLength]
	ciphertext := combined[saltLength+ivLength+authTagLength:]

	key := e.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := aesgcm.Open(nil, iv, append(authTag, ciphertext...), nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

func (e *Encryption) deriveKey(salt []byte) []byte {
	derivedKey := make([]byte, keyLength)
	pbkdf2 := &pbkdf2{
		password:   e.key,
		salt:       salt,
		iterations: iterations,
		hashFunc:   func() interface{} { return sha256.New() },
		keyLength:  keyLength,
	}
	pbkdf2.XORKeyStream(derivedKey)
	return derivedKey
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

type pbkdf2 struct {
	password   []byte
	salt       []byte
	iterations int
	hashFunc   func() interface{}
	keyLength  int
}

func (p *pbkdf2) XORKeyStream(dst []byte) {
	U := make([]byte, p.keyLength)
	T := make([]byte, p.keyLength)

	block := p.hashFunc().(interface {
		Reset()
		Write([]byte) (int, error)
		Sum([]byte) []byte
	})

	for i := 0; len(dst) > 0; i++ {
		block.Reset()
		block.Write(p.salt)
		block.Write([]byte{byte(i + 1), byte((i + 1) >> 8), byte((i + 1) >> 16), byte((i + 1) >> 24)})
		block.Write(p.password)
		U = block.Sum(nil)

		copy(T, U)

		for j := 1; j < p.iterations; j++ {
			block.Reset()
			block.Write(U)
			U = block.Sum(nil)
			for k := 0; k < p.keyLength; k++ {
				T[k] ^= U[k]
			}
		}

		copy(dst, T)
		dst = dst[p.keyLength:]
	}
}
