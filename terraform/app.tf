# =====================================================================
# App Service Linux (Node.js LTS) con VNet Integration y Managed Identity
# =====================================================================
resource "azurerm_service_plan" "plan" {
  count               = var.existing_service_plan_id == null ? 1 : 0
  name                = "asp-${local.base}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "B1"
  tags                = var.tags
}

locals {
  service_plan_id = var.existing_service_plan_id != null ? var.existing_service_plan_id : azurerm_service_plan.plan[0].id

  kv_ref = {
    DATABASE_URL   = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.database_url.versionless_id})"
    SESSION_SECRET = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.session_secret.versionless_id})"
  }

  kv_ref_extra = {
    for k, s in azurerm_key_vault_secret.extra :
    k => "@Microsoft.KeyVault(SecretUri=${s.versionless_id})"
  }
}

resource "azurerm_linux_web_app" "app" {
  name                = "app-${local.base}-${local.sfx}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  service_plan_id     = local.service_plan_id
  https_only          = true

  # Toda la salida de la app pasa por la VNet -> resuelve PostgreSQL por IP privada
  virtual_network_subnet_id = azurerm_subnet.app.id

  # Publish profile habilitado para GitHub Actions; FTP deshabilitado
  webdeploy_publish_basic_authentication_enabled = true
  ftp_publish_basic_authentication_enabled       = false

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on              = true
    websockets_enabled     = true # módulo ws (chat, llamadas, notificaciones)
    http2_enabled          = true
    minimum_tls_version    = "1.2"
    ftps_state             = "Disabled"
    vnet_route_all_enabled = true
    # db:init es idempotente (CREATE TABLE IF NOT EXISTS, sin borrar datos): crea las tablas base antes de arrancar
    app_command_line = "npm run db:init && npm start"

    application_stack {
      node_version = var.node_version
    }
  }

  app_settings = merge(
    {
      NODE_ENV                                   = "production"
      SCM_DO_BUILD_DURING_DEPLOYMENT             = "true" # Oryx: npm install + npm run build (prisma generate)
      APPLICATIONINSIGHTS_CONNECTION_STRING      = azurerm_application_insights.appi.connection_string
      ApplicationInsightsAgent_EXTENSION_VERSION = "~3"
    },
    local.kv_ref,
    var.extra_app_settings,
    local.kv_ref_extra,
  )

  logs {
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
    application_logs {
      file_system_level = "Information"
    }
  }

  tags = var.tags

  lifecycle {
    # Las asigna el paso "app_urls" con la URL real de la app
    ignore_changes = [
      app_settings["BASE_URL"],
      app_settings["CORS_ORIGIN"],
      app_settings["MERCADOPAGO_BACK_URL"],
    ]
  }

  depends_on = [azurerm_subnet_network_security_group_association.app]
}

# Azure asigna un nombre de host único (con hash) que solo se conoce después de crear la app.
# Este paso guarda esa URL en BASE_URL (callbacks OAuth), CORS_ORIGIN y MERCADOPAGO_BACK_URL.
resource "terraform_data" "app_urls" {
  triggers_replace = [azurerm_linux_web_app.app.default_hostname]

  provisioner "local-exec" {
    command = "az webapp config appsettings set -g ${azurerm_resource_group.rg.name} -n ${azurerm_linux_web_app.app.name} --settings BASE_URL=https://${azurerm_linux_web_app.app.default_hostname} CORS_ORIGIN=https://${azurerm_linux_web_app.app.default_hostname} MERCADOPAGO_BACK_URL=https://${azurerm_linux_web_app.app.default_hostname} -o none"
  }

  depends_on = [azurerm_role_assignment.kv_user_app]
}
