# AWS deployment outline

This demo is intentionally local-first. For AWS, keep the same application boundaries:

1. **Database:** Amazon RDS for PostgreSQL. Create the `fleet` database and run `db/init.sql` once.
2. **Redis:** Amazon ElastiCache for Redis/Valkey. Put the API service in the same VPC/subnets as Redis.
3. **API:** Build `server/` as an image and deploy to ECS Fargate behind an Application Load Balancer. ALB supports WebSocket connections; configure health check `/health`.
4. **Frontend:** Build `client/` with `npm run build` and serve the static files from S3 + CloudFront, or deploy the included client container behind an ALB.
5. **Secrets:** Put `DATABASE_URL`, `REDIS_URL`, and CORS settings in AWS Secrets Manager/SSM rather than the image.
6. **Security:** Restrict RDS/Redis security groups to the ECS service, use HTTPS at the ALB/CloudFront layer, and do not expose PostgreSQL/Redis publicly.
7. **Scaling:** Socket.io requires sticky-session planning when using multiple API instances, or use a Socket.IO Redis adapter so events are shared across instances. This demo already uses Redis pub/sub for application events.

## Example production environment
```text
DATABASE_URL=postgres://USER:PASSWORD@RDS_ENDPOINT:5432/fleet
REDIS_URL=redis://ELASTICACHE_ENDPOINT:6379
CORS_ORIGIN=https://your-domain.example
PORT=4000
```
