# ==============================================================================
# Salidas (Outputs) de la Infraestructura
# ==============================================================================

output "resource_group_name" {
  description = "Nombre del Resource Group en Azure"
  value       = azurerm_resource_group.rg.name
}

output "web_app_url" {
  description = "URL pública segura de la aplicación en Azure App Service"
  value       = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "web_app_outbound_ip_addresses" {
  description = "Direcciones IP salientes asignadas al App Service"
  value       = azurerm_linux_web_app.app.outbound_ip_address_list
}

output "postgres_fqdn" {
  description = "Nombre de dominio totalmente calificado (FQDN) del servidor PostgreSQL"
  value       = azurerm_postgresql_flexible_server.psql.fqdn
}

output "postgres_database_name" {
  description = "Nombre de la base de datos creada"
  value       = azurerm_postgresql_flexible_server_database.db.name
}

output "storage_account_name" {
  description = "Nombre de la cuenta de Azure Blob Storage"
  value       = azurerm_storage_account.sa.name
}

output "storage_uploads_container" {
  description = "Nombre del contenedor de archivos adjuntos"
  value       = azurerm_storage_container.uploads.name
}

output "key_vault_uri" {
  description = "URI del almacén de secretos Azure Key Vault"
  value       = azurerm_key_vault.kv.vault_uri
}

output "app_insights_connection_string" {
  description = "Cadena de conexión para Application Insights"
  value       = azurerm_application_insights.appi.connection_string
  sensitive   = true
}
