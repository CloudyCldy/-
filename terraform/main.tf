# ==============================================================================
# Haitani - Infraestructura en Azure (Azure for Students)
# Configuración principal, providers y etiquetas globales
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Grupo de recursos principal (Organización centralizada para fácil monitoreo y eliminación)
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

locals {
  # Sufijo consistente para recursos con nombres globales
  unique_suffix = var.resource_suffix

  # Nombres estandarizados siguiendo Cloud Adoption Framework (CAF)
  app_service_name   = "${var.project_name}-app-${local.unique_suffix}"
  postgres_name      = "${var.project_name}-psql-${local.unique_suffix}"
  storage_name       = replace(lower("${var.project_name}st${local.unique_suffix}"), "-", "")
  key_vault_name     = "${var.project_name}-kv-${local.unique_suffix}"
  app_insights_name  = "${var.project_name}-appi-${local.unique_suffix}"
  log_analytics_name = "${var.project_name}-law-${local.unique_suffix}"

  common_tags = merge(var.extra_tags, {
    Project     = "Haitani-SakuraCoffee"
    Environment = var.environment
    CostCenter  = "AzureForStudents"
    ManagedBy   = "Terraform"
  })
}

