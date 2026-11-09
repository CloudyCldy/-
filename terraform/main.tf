resource "random_string" "sfx" {
  length  = 4
  upper   = false
  special = false
}

locals {
  base = "${var.project}-${var.environment}" # haitani-prod
  sfx  = random_string.sfx.result            # sufijo para nombres globales únicos
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${local.base}-ncus-001"
  location = var.location
  tags     = var.tags
}
