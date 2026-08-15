# Terraform skeleton — EduPulse AWS Infrastructure
# Will be implemented in Phase 1 (Week 2-3)

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  default     = "ap-southeast-1"  # Singapore — closest to Vietnam
}

variable "project_name" {
  description = "Project name for resource tagging"
  default     = "edupulse"
}

# ============================================
# VPC
# ============================================
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

# ============================================
# Outputs
# ============================================
output "vpc_id" {
  value = aws_vpc.main.id
}
