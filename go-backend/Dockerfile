FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git build-base gcc musl-dev

WORKDIR /app

COPY go.mod ./

RUN go mod download

COPY . .

# RUN CGO_ENABLED=1 GOOS=linux go build -o bin/server ./cmd/main.go
RUN CGO_ENABLED=1 CGO_CFLAGS="-D_LARGEFILE64_SOURCE" GOOS=linux go build -o bin/server ./cmd/main.go

FROM alpine:3.19

RUN apk --no-cache add ca-certificates sqlite

RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

WORKDIR /app

COPY --from=builder /app/bin/server ./bin/server

COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["./bin/server"]
