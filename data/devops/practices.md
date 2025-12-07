# DevOps Practices

## Infrastructure as Code

```typescript
// Pulumi example
const bucket = new aws.s3.Bucket("app-bucket", {
  acl: "private",
  versioning: { enabled: true }
});

const lambda = new aws.lambda.Function("api", {
  runtime: "nodejs20.x",
  handler: "index.handler",
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./dist")
  })
});
```

## Containerization

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Observability

### Logging
```typescript
logger.info('Order created', {
  orderId: order.id,
  customerId: order.customerId,
  total: order.total,
  timestamp: new Date().toISOString()
});
```

### Metrics
```typescript
metrics.increment('orders.created');
metrics.histogram('order.value', order.total);
metrics.timing('order.processing_time', duration);
```

### Health Checks
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.APP_VERSION,
    uptime: process.uptime()
  });
});
```

## Best Practices

- Version control all infrastructure
- Use immutable infrastructure
- Implement proper secret management
- Set up alerting for critical metrics
- Use structured logging (JSON)
- Include correlation IDs for tracing
- Document runbooks for incidents
