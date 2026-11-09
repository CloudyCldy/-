output "resource_group" {
  value = azurerm_resource_group.rg.name
}

output "app_name" {
  value = azurerm_linux_web_app.app.name
}

output "app_url" {
  value = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.pg.fqdn
}

output "postgres_private_ip" {
  value = azurerm_private_endpoint.pg.private_service_connection[0].private_ip_address
}

output "postgres_admin_user" {
  value = var.pg_admin_user
}

output "key_vault" {
  value = azurerm_key_vault.kv.name
}

output "key_vault_secrets" {
  value = concat(
    [azurerm_key_vault_secret.database_url.name, azurerm_key_vault_secret.session_secret.name, azurerm_key_vault_secret.pg_password.name],
    [for s in azurerm_key_vault_secret.extra : s.name]
  )
}

output "app_insights" {
  value = azurerm_application_insights.appi.name
}

output "admin_vm" {
  value = var.enable_admin_vm ? "${azurerm_linux_virtual_machine.admin[0].name} (llave: admin-vm-key.pem, usuario azureuser)" : "deshabilitada"
}
