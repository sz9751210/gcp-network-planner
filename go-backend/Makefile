.PHONY: build run test clean deps

# Build the Go backend
build:
	go build -o bin/server ./cmd/main.go

# Run the Go backend
run: build
	./bin/server

# Run with hot reload (requires air)
dev:
	air

# Download dependencies
deps:
	go mod tidy
	go mod download

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f *.db

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run ./...

# Setup development environment
setup: deps build
