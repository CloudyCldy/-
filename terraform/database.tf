# ==============================================================================
# Capa de Base de Datos - Azure Database for PostgreSQL Flexible Server
# Configuración económica Burstable (B1ms) con SSL forzado y cuota de disco fija
# ==============================================================================

resource "azurerm_postgresql_flexible_server" "psql" {
  name                   = local.postgres_name
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  zone                   = "1"

  # Nivel de cómputo y almacenamiento económico para estudiantes
  sku_name     = "B_Standard_B1ms" # Burstable: 1 vCore, 2 GB RAM
  storage_mb   = 32768             # 32 GB (Mínimo recomendado)
  storage_tier = "P4"

  # Control de costos crítico: Desactivar crecimiento automático para evitar sobregiro de créditos
  auto_grow_enabled     = false
  backup_retention_days = 7

  tags = local.common_tags
}

# Base de datos de la aplicación para esquemas multi-inquilino y sesiones (connect-pg-simple)
resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "haitani"
  server_id = azurerm_postgresql_flexible_server.psql.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Regla de Firewall: Permite tráfico exclusivamente desde servicios internos de Azure (App Service)
# '0.0.0.0' representa la directiva estándar 'Allow public access from any Azure service within Azure'
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "AllowInternalAzureServices"
  server_id        = azurerm_postgresql_flexible_server.psql.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
