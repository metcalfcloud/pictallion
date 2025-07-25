#!/bin/bash
# Create fresh docker-compose.yml
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://pictallion:pictallion_password@postgres:5432/pictallion
      - NODE_ENV=production
    depends_on:
      - postgres
    volumes:
      - ./data:/app/data

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pictallion
      POSTGRES_USER: pictallion
      POSTGRES_PASSWORD: pictallion_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
COMPOSE_EOF

echo "✅ Fresh docker-compose.yml created"