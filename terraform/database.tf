# =====================================================================
# Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
# Sin acceso público: solo por Private Endpoint en snet-pe.
# La app crea sus tablas sola al arrancar (app.js) y guarda las sesiones
# (connect-pg-simple, tabla user_sessions) y los archivos (tabla stored_assets).
# =====================================================================
resource "random_password" "pg" {
  length           = 28
  special          = true
  override_special = "-_" # caracteres seguros dentro de una URL
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
}

resource "azurerm_postgresql_flexible_server" "pg" {
  name                = "psql-${local.base}-${local.sfx}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  version             = var.pg_version

  sku_name     = "B_Standard_B1ms"
  storage_mb   = 32768
  storage_tier = "P4"

  administrator_login    = var.pg_admin_user
  administrator_password = random_password.pg.result

  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = false

  tags = var.tags

  lifecycle {
    ignore_changes = [zone, high_availability]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = var.pg_database_name
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_private_endpoint" "pg" {
  name                          = "pe-psql-${local.base}"
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  subnet_id                     = azurerm_subnet.pe.id
  custom_network_interface_name = "nic-pe-psql-${local.base}"
  tags                          = var.tags

  private_service_connection {
    name                           = "psc-psql-${local.base}"
    private_connection_resource_id = azurerm_postgresql_flexible_server.pg.id
    subresource_names              = ["postgresqlServer"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.postgres.id]
  }

  depends_on = [
    azurerm_subnet_network_security_group_association.pe,
    azurerm_private_dns_zone_virtual_network_link.postgres,
  ]
}

locals {
  # La app activa SSL sola para hosts que no son localhost (server/database.js)
  database_url = format(
    "postgresql://%s:%s@%s:5432/%s",
    var.pg_admin_user,
    urlencode(random_password.pg.result),
    azurerm_postgresql_flexible_server.pg.fqdn,
    var.pg_database_name
  )
}


# La app ejecuta "CREATE EXTENSION IF NOT EXISTS pgcrypto" en database/init.js.
# Azure solo permite crear extensiones que estén en la lista azure.extensions.
resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.pg.id
  value     = "PGCRYPTO"
}
