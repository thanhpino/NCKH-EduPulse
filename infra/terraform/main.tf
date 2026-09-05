terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -------------------------------------------------------------
# VPC and Subnet Setup (Foundation for Microservices)
# -------------------------------------------------------------
resource "aws_vpc" "edupulse_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "EduPulse-VPC"
    Environment = "Production"
  }
}

resource "aws_internet_gateway" "edupulse_igw" {
  vpc_id = aws_vpc.edupulse_vpc.id

  tags = {
    Name = "EduPulse-IGW"
  }
}

resource "aws_subnet" "edupulse_public_subnet" {
  vpc_id                  = aws_vpc.edupulse_vpc.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "ap-southeast-1a" # Singapore region

  tags = {
    Name = "EduPulse-Public-Subnet"
  }
}

resource "aws_route_table" "edupulse_rt" {
  vpc_id = aws_vpc.edupulse_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.edupulse_igw.id
  }
}

resource "aws_route_table_association" "edupulse_rta" {
  subnet_id      = aws_subnet.edupulse_public_subnet.id
  route_table_id = aws_route_table.edupulse_rt.id
}

# -------------------------------------------------------------
# Security Groups
# -------------------------------------------------------------
resource "aws_security_group" "edupulse_sg" {
  name        = "edupulse-web-sg"
  description = "Allow HTTP and SSH traffic"
  vpc_id      = aws_vpc.edupulse_vpc.id

  # Allow HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow Dashboard/Proxy Custom Port (Optional, e.g. Nginx on 8080)
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # restrict in reality
  }

  # Outbound allow all
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "EduPulse-SG"
  }
}

# -------------------------------------------------------------
# EC2 Instance Setup (Docker Host)
# -------------------------------------------------------------
resource "aws_instance" "edupulse_docker_host" {
  # Amazon Linux 2023 AMI in ap-southeast-1 (Singapore)
  ami           = "ami-0ac1bd03009949ee1"
  instance_type = "t3.medium" # Need at least 4GB RAM for 6 services + Redis + Mongo

  subnet_id                   = aws_subnet.edupulse_public_subnet.id
  vpc_security_group_ids      = [aws_security_group.edupulse_sg.id]
  associate_public_ip_address = true
  
  # key_name = "edupulse-ssh-key" # Uncomment when SSH key is generated

  user_data = <<-EOF
              #!/bin/bash
              # 1. Update and install Docker
              dnf update -y
              dnf install -y docker git curl
              systemctl start docker
              systemctl enable docker
              usermod -aG docker ec2-user
              
              # 2. Install Docker Compose
              curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
              chmod +x /usr/local/bin/docker-compose
              ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
              EOF

  tags = {
    Name = "EduPulse-Server"
  }
}

# -------------------------------------------------------------
# Outputs (E.g. IP Address to access)
# -------------------------------------------------------------
output "server_public_ip" {
  description = "Public IP address of the EduPulse server"
  value       = aws_instance.edupulse_docker_host.public_ip
}
