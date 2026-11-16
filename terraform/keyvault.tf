# =====================================================================
# Azure Key Vault (RBAC). Guarda TODOS los secretos de la app.
# La app los lee con su Managed Identity mediante referencias
# @Microsoft.KeyVault(...) en sus variables de entorno.
# =====================================================================
resource "azurerm_key_vault" "kv" {
  name                       = "kv-${local.base}-${local.sfx}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = false
  soft_delete_retention_days = 7

  # Acceso por red abierto pero protegido por RBAC: permite que Terraform
  # (Cloud Shell / tu PC) cree los secretos y que App Service resuelva las referencias.
  network_acls {
    default_action = "Allow"
    bypass         = "AzureServices"
  }

  tags = var.tags
}

# Quien ejecuta Terraform necesita escribir secretos
resource "azurerm_role_assignment" "kv_officer_me" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Los permisos RBAC tardan en propagarse; sin esta espera el primer apply da 403
resource "time_sleep" "kv_rbac" {
  create_duration = "60s"
  depends_on      = [azurerm_role_assignment.kv_officer_me]
}

resource "random_password" "session" {
  length  = 64
  special = false
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "DATABASE-URL"
  value        = local.database_url
  key_vault_id = azurerm_key_vault.kv.id
  content_type = "connection-string"
  depends_on   = [time_sleep.kv_rbac]
}

resource "azurerm_key_vault_secret" "session_secret" {
  name         = "SESSION-SECRET"
  value        = random_password.session.result
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [time_sleep.kv_rbac]
}

resource "azurerm_key_vault_secret" "pg_password" {
  name         = "POSTGRES-ADMIN-PASSWORD"
  value        = random_password.pg.result
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [time_sleep.kv_rbac]
}

# Secretos opcionales: SANZU_API_KEY, MERCADOPAGO_ACCESS_TOKEN, GITHUB_CLIENT_SECRET, ...
# (Key Vault no admite "_", se guardan como SANZU-API-KEY, etc.)
resource "azurerm_key_vault_secret" "extra" {
  for_each     = toset(nonsensitive(keys(var.app_secrets)))
  name         = replace(each.key, "_", "-")
  value        = var.app_secrets[each.key]
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [time_sleep.kv_rbac]
}

# La Managed Identity de la app solo puede LEER secretos (mínimo privilegio)
resource "azurerm_role_assignment" "kv_user_app" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.app.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
