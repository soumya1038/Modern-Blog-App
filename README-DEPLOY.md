# Deployment & Observability Guide

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **MongoDB Atlas Account** 
3. **Terraform** installed locally
4. **Docker** installed locally
5. **AWS CLI** configured

## Infrastructure Setup

### 1. Create ECR Repository

```bash
aws ecr create-repository --repository-name blog-app --region us-east-1
```

### 2. Configure Variables

Copy `terraform/terraform.tfvars.example` to `terraform/terraform.tfvars` and fill in your values:

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

### 3. Deploy Infrastructure

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Set environment variables
export AWS_REGION=us-east-1
export ECR_REPOSITORY_URL=123456789012.dkr.ecr.us-east-1.amazonaws.com/blog-app
export MONGODB_ATLAS_PUBLIC_KEY=your-key
export MONGODB_ATLAS_PRIVATE_KEY=your-key
export UPTIME_ROBOT_API_KEY=your-key

# Deploy
./scripts/deploy.sh
```

## Infrastructure Components

### AWS Resources Created

- **VPC** with public/private subnets
- **ECS Fargate** cluster with API service
- **Application Load Balancer** 
- **S3 + CloudFront** for static web hosting
- **ElastiCache Redis** cluster
- **EFS** for persistent monitoring data
- **CloudWatch** logs and alarms
- **SSM Parameters** for secrets

### MongoDB Atlas

- **M10 cluster** with VPC peering
- **Database user** with read/write access
- **IP access list** for VPC CIDR

### Monitoring Stack

- **Prometheus** for metrics collection
- **Grafana** for dashboards
- **Node Exporter** for system metrics
- **Sentry** for error tracking
- **Uptime Robot** for health monitoring

## Observability Features

### Metrics Collected

- **HTTP metrics**: Request duration, rate, errors
- **System metrics**: CPU, memory, disk usage
- **Database metrics**: MongoDB connections, operations
- **Redis metrics**: Memory usage, operations
- **Custom metrics**: Business logic metrics

### Dashboards

Access Grafana at: `http://<alb-dns>:3000`
- Default login: admin/admin123
- Pre-configured dashboard with 8 panels
- Real-time metrics with 30s refresh

### Error Tracking

Sentry integration provides:
- Real-time error reporting
- Performance monitoring
- Source map support
- Release tracking

### Health Monitoring

Uptime Robot monitors `/health` endpoint:
- 5-minute intervals
- Email/SMS alerts on downtime
- Response time tracking

## Deployment Verification

### 1. Check Infrastructure

```bash
cd terraform
terraform output
```

### 2. Verify Services

```bash
# API health check
curl https://<cloudfront-domain>/health

# Metrics endpoint
curl https://<cloudfront-domain>/metrics

# Grafana dashboard
open http://<alb-dns>:3000
```

### 3. Test Application

```bash
# Web application
open https://<cloudfront-domain>

# API endpoints
curl https://<cloudfront-domain>/v1/posts
```

## Monitoring Alerts

### CloudWatch Alarms

- **CPU > 80%** for 2 consecutive periods
- **Memory > 80%** for 2 consecutive periods  
- **API errors > 10** in 5 minutes

### Grafana Alerts

- **Response time > 1s** (95th percentile)
- **Error rate > 5%**
- **Database connections > 80%** of limit

## Scaling Configuration

### Auto Scaling

ECS service configured with:
- **Min capacity**: 2 tasks
- **Max capacity**: 10 tasks
- **Target CPU**: 70%
- **Target memory**: 80%

### Database Scaling

MongoDB Atlas M10 cluster:
- **Auto-scaling**: Enabled
- **Storage**: Auto-expand
- **Backup**: Point-in-time recovery

## Security Features

### Network Security

- **VPC isolation** with private subnets
- **Security groups** with minimal access
- **NAT Gateway** for outbound traffic
- **VPC peering** to MongoDB Atlas

### Data Security

- **Encryption at rest** for all storage
- **Encryption in transit** with TLS
- **SSM Parameter Store** for secrets
- **IAM roles** with least privilege

## Cost Optimization

### Resource Sizing

- **ECS Fargate**: 0.5 vCPU, 1GB RAM
- **MongoDB**: M10 cluster (2GB RAM)
- **Redis**: cache.t3.micro
- **CloudFront**: Pay-as-you-go

### Estimated Monthly Cost

- **ECS Fargate**: ~$30
- **MongoDB Atlas**: ~$57
- **ElastiCache**: ~$15
- **Data transfer**: ~$10
- **Total**: ~$112/month

## Troubleshooting

### Common Issues

1. **ECS tasks failing**: Check CloudWatch logs
2. **Database connection**: Verify VPC peering
3. **High latency**: Check CloudFront cache
4. **Monitoring gaps**: Verify Prometheus targets

### Useful Commands

```bash
# View ECS logs
aws logs tail /ecs/blog-app-api --follow

# Check ECS service status
aws ecs describe-services --cluster blog-app-cluster --services blog-app-api

# Test database connection
mongosh "mongodb+srv://cluster.mongodb.net/blog" --username blogapp
```

## Cleanup

To destroy all resources:

```bash
cd terraform
terraform destroy
```

**Warning**: This will permanently delete all data and resources.