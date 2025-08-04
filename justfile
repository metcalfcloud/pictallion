# justfile for reproducible workflows
# Recipes for frontend and backend build, test, lint, coverage, docker compose, and deployment
# All commands match those documented in README.md and DEPLOYMENT.md

# --- Frontend ---
frontend-build:
    cd client && npm run build

frontend-dev:
    cd client && npm run dev

frontend-test:
    cd client && npm run test

frontend-lint:
    cd client && npm run lint

frontend-typecheck:
    cd client && npm run check

# --- Backend ---
backend-dev:
    cd server_py && python -m uvicorn app.main:app --reload --port 8000

backend-migrate:
    cd server_py && python manage_db.py migrate

backend-test:
    cd server_py && pytest

backend-coverage:
    cd server_py && pytest --cov=app --cov-report=term-missing

backend-lint:
    cd server_py && black . && isort . && mypy app

# --- Docker Compose ---
docker-up:
    docker compose -f docker/docker-compose.yml up --build

docker-down:
    docker compose -f docker/docker-compose.yml down

docker-test-config:
    ./scripts/test-docker-config.sh

docker-setup:
    ./scripts/docker-setup.sh

# --- Deployment ---
deploy-production:
    ./scripts/build-production.sh

deploy-docker:
    ./scripts/build-docker.sh

package:
    ./scripts/ci/package.sh
