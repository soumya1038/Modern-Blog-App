# SSM Parameters for secrets
resource "aws_ssm_parameter" "mongodb_uri" {
  name  = "/${var.project_name}/mongodb_uri"
  type  = "SecureString"
  value = mongodbatlas_cluster.main.mongo_uri_with_options

  tags = {
    Name = "${var.project_name}-mongodb-uri"
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project_name}/jwt_secret"
  type  = "SecureString"
  value = var.jwt_secret

  tags = {
    Name = "${var.project_name}-jwt-secret"
  }
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "/${var.project_name}/redis_url"
  type  = "SecureString"
  value = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"

  tags = {
    Name = "${var.project_name}-redis-url"
  }
}

resource "aws_ssm_parameter" "cloudinary_cloud_name" {
  name  = "/${var.project_name}/cloudinary_cloud_name"
  type  = "String"
  value = var.cloudinary_cloud_name

  tags = {
    Name = "${var.project_name}-cloudinary-cloud-name"
  }
}

resource "aws_ssm_parameter" "cloudinary_api_key" {
  name  = "/${var.project_name}/cloudinary_api_key"
  type  = "SecureString"
  value = var.cloudinary_api_key

  tags = {
    Name = "${var.project_name}-cloudinary-api-key"
  }
}

resource "aws_ssm_parameter" "cloudinary_api_secret" {
  name  = "/${var.project_name}/cloudinary_api_secret"
  type  = "SecureString"
  value = var.cloudinary_api_secret

  tags = {
    Name = "${var.project_name}-cloudinary-api-secret"
  }
}