output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "s3_bucket_name" {
  description = "S3 bucket name for web hosting"
  value       = aws_s3_bucket.web.id
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.api.dns_name
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "http://${aws_lb.api.dns_name}"
}

output "grafana_endpoint" {
  description = "Grafana dashboard URL"
  value       = "http://${aws_lb.api.dns_name}:3000"
}

output "mongodb_connection_string" {
  description = "MongoDB Atlas connection string"
  value       = mongodbatlas_cluster.main.mongo_uri_with_options
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "web_url" {
  description = "Web application URL"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "health_check_url" {
  description = "Health check endpoint"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}/health"
}