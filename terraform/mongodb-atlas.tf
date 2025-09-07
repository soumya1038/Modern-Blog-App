# MongoDB Atlas Project
resource "mongodbatlas_project" "main" {
  name   = var.project_name
  org_id = var.mongodb_atlas_org_id
}

# MongoDB Atlas Cluster
resource "mongodbatlas_cluster" "main" {
  project_id   = mongodbatlas_project.main.id
  name         = "${var.project_name}-cluster"
  cluster_type = "REPLICASET"

  provider_name               = "AWS"
  provider_region_name        = upper(replace(var.aws_region, "-", "_"))
  provider_instance_size_name = "M10"

  mongo_db_major_version = "7.0"

  # Enable backups
  backup_enabled = true
  pit_enabled    = true

  # Advanced configuration
  advanced_configuration {
    javascript_enabled                   = false
    minimum_enabled_tls_protocol        = "TLS1_2"
    no_table_scan                       = true
    oplog_size_mb                       = 2048
    sample_size_bi_connector            = 5000
    sample_refresh_interval_bi_connector = 300
  }
}

# VPC Peering Connection
resource "mongodbatlas_network_peering" "main" {
  accepter_region_name   = var.aws_region
  project_id             = mongodbatlas_project.main.id
  container_id           = mongodbatlas_cluster.main.container_id
  provider_name          = "AWS"
  route_table_cidr_block = aws_vpc.main.cidr_block
  vpc_id                 = aws_vpc.main.id
  aws_account_id         = data.aws_caller_identity.current.account_id
}

# Accept VPC Peering on AWS side
resource "aws_vpc_peering_connection_accepter" "main" {
  vpc_peering_connection_id = mongodbatlas_network_peering.main.connection_id
  auto_accept               = true

  tags = {
    Name = "${var.project_name}-mongodb-peering"
  }
}

# Route to MongoDB Atlas
resource "aws_route" "mongodb_private" {
  route_table_id            = aws_route_table.private.id
  destination_cidr_block    = mongodbatlas_cluster.main.mongo_uri_with_options
  vpc_peering_connection_id = mongodbatlas_network_peering.main.connection_id
}

# Database User
resource "mongodbatlas_database_user" "main" {
  username           = var.mongodb_username
  password           = var.mongodb_password
  project_id         = mongodbatlas_project.main.id
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = var.mongodb_database_name
  }

  roles {
    role_name     = "dbAdmin"
    database_name = var.mongodb_database_name
  }
}

# IP Access List (allow VPC CIDR)
resource "mongodbatlas_project_ip_access_list" "vpc" {
  project_id = mongodbatlas_project.main.id
  cidr_block = aws_vpc.main.cidr_block
  comment    = "VPC CIDR access"
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}