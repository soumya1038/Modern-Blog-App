#!/bin/bash

set -e

echo "🚀 Starting deployment process..."

# Check if required environment variables are set
required_vars=("AWS_REGION" "ECR_REPOSITORY_URL" "MONGODB_ATLAS_PUBLIC_KEY" "MONGODB_ATLAS_PRIVATE_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set"
        exit 1
    fi
done

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t blog-app .

echo "🏷️  Tagging image..."
docker tag blog-app:latest $ECR_REPOSITORY_URL:latest
docker tag blog-app:latest $ECR_REPOSITORY_URL:$(git rev-parse --short HEAD)

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URL

echo "⬆️  Pushing image to ECR..."
docker push $ECR_REPOSITORY_URL:latest
docker push $ECR_REPOSITORY_URL:$(git rev-parse --short HEAD)

# Deploy infrastructure
echo "🏗️  Deploying infrastructure with Terraform..."
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply deployment
terraform apply tfplan

# Get outputs
echo "📋 Deployment outputs:"
terraform output

echo "✅ Deployment completed successfully!"

# Setup monitoring
echo "📊 Setting up monitoring..."

# Upload Grafana dashboard
GRAFANA_URL=$(terraform output -raw grafana_endpoint)
echo "Grafana available at: $GRAFANA_URL"

# Setup Uptime Robot monitoring
if [ ! -z "$UPTIME_ROBOT_API_KEY" ]; then
    HEALTH_URL=$(terraform output -raw health_check_url)
    echo "Setting up Uptime Robot monitoring for: $HEALTH_URL"
    
    curl -X POST "https://api.uptimerobot.com/v2/newMonitor" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "api_key=$UPTIME_ROBOT_API_KEY" \
        -d "format=json" \
        -d "type=1" \
        -d "url=$HEALTH_URL" \
        -d "friendly_name=Blog App Health Check" \
        -d "interval=300"
fi

echo "🎉 All done! Your blog app is now deployed and monitored."