# ==============================================================================
# Capa de Seguridad y Gestión de Secretos - Azure Key Vault
# Almacenamiento seguro de credenciales con acceso vía Managed Identity
# ==============================================================================

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                       = local.key_vault_name
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  sku_name                   = "standard"
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days = 7
  purge_protection_enabled   = false # Facilita destruir y limpiar recursos en entorno de estudiante

  # Política de Acceso 1: Usuario/Entidad que ejecuta Terraform (para crear los secretos iniciales)
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]
  }

  # Política de Acceso 2: Managed Identity del App Service (Principio de Mínimo Privilegio)
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_linux_web_app.app.identity[0].principal_id

    secret_permissions = [
      "Get", "List"
    ]
  }

  tags = local.common_tags
}

# Secreto para la cadena de conexión de PostgreSQL (con SSL forzado)
resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = "postgresql://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.psql.fqdn}:5432/${azurerm_postgresql_flexible_server_database.db.name}?sslmode=require"
  key_vault_id = azurerm_key_vault.kv.id

  depends_on = [
    azurerm_key_vault.kv,
    azurerm_postgresql_flexible_server.psql,
    azurerm_postgresql_flexible_server_database.db
  ]
}

# Secreto para la firma de cookies de sesión
resource "azurerm_key_vault_secret" "session_secret" {
  name         = "session-secret"
  value        = var.session_secret
  key_vault_id = azurerm_key_vault.kv.id

  depends_on = [
    azurerm_key_vault.kv
  ]
}
