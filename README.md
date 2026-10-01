# Real-Time Fleet Monitoring Dashboard

A small, functional fleet-monitoring demo built with React, Node.js/Express, Socket.IO, PostgreSQL, Redis, Docker, and AWS-ready deployment notes.

## Features
- Live driver status dashboard
- Real-time location/status updates over Socket.IO
- Express REST API
- PostgreSQL persistence for drivers and events
- Redis pub/sub for real-time event fan-out
- Demo simulator that changes driver status/location automatically
- Docker Compose for local development
- AWS deployment notes for ECS/Fargate + RDS + ElastiCache

## Run locally

### Requirements
- Docker + Docker Compose

### Start
```bash
docker compose up --build
```

Open http://localhost:5173

The API is available at http://localhost:4000/health.

## Demo behavior
The server seeds 8 drivers and starts a simulator. Every few seconds, a random driver gets a new location/status. The update is persisted in PostgreSQL, published through Redis, and broadcast to connected dashboards through Socket.IO.

## Project structure
```text
fleet-monitoring-dashboard/
├── client/          # React + Vite dashboard
├── server/          # Express + Socket.IO + PostgreSQL + Redis
├── db/              # PostgreSQL initialization
├── nginx/           # Optional production reverse proxy config
├── docker-compose.yml
└── README.md
```

## Useful API endpoints
- `GET /health`
- `GET /api/drivers`
- `GET /api/events?limit=30`
- `PATCH /api/drivers/:id/status` with `{ "status": "ON_TRIP" }`

## AWS deployment direction
For a production deployment, use:
- React static build behind CloudFront/S3 or an Nginx container
- Node API on ECS/Fargate
- PostgreSQL on Amazon RDS
- Redis on ElastiCache for Redis
- ALB with WebSocket support
- Secrets Manager/SSM for database and Redis credentials