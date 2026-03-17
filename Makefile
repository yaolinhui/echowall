# KudosWall Development Commands

.PHONY: install test test-unit test-e2e test-load dev build docker-up docker-down

# Install dependencies
install:
	cd backend && npm install
	cd frontend && npm install

# Run all tests
test: test-unit test-e2e

# Unit & Integration tests
test-unit:
	@echo "Running backend tests..."
	cd backend && npm run test:ci
	@echo "Running frontend tests..."
	cd frontend && npm run test:run

# E2E tests
test-e2e:
	@echo "Running E2E tests..."
	npx playwright test

# Performance tests
test-load:
	@echo "Running load tests..."
	k6 run tests/load/api-load.js

test-stress:
	@echo "Running stress tests..."
	k6 run tests/load/stress-test.js

test-spike:
	@echo "Running spike tests..."
	k6 run tests/load/spike-test.js

# Development
dev:
	docker-compose up -d
	@echo "Waiting for services..."
	sleep 5
	cd backend && npm run start:dev &
	cd frontend && npm run dev

# Build
build:
	cd backend && npm run build
	cd frontend && npm run build

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Lint
lint:
	cd backend && npm run lint
	cd frontend && npm run lint

# Coverage
coverage:
	cd backend && npm run test:cov
	cd frontend && npm run test:cov

# Clean
clean:
	cd backend && rm -rf node_modules dist coverage
	cd frontend && rm -rf node_modules dist coverage
	docker-compose down -v
