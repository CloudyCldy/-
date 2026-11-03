# ==============================================================================
# Capa de Cómputo (PaaS) - Azure App Service Linux B1
# Diseñado para soportar Node.js 20 LTS, WebSockets (ws) y Managed Identity
# ==============================================================================

# Plan de servicio de nivel B1 (Burstable / Básico - Compatible con Azure for Students)
resource "azurerm_service_plan" "asp" {
  name                = "${var.project_name}-asp-${local.unique_suffix}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1" # Nivel económico que permite WebSockets y Always-On
  tags                = local.common_tags
}

# Aplicación web Linux para el backend Express + WebSockets + Frontend Vanilla
resource "azurerm_linux_web_app" "app" {
  name                = local.app_service_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_service_plan.asp.location
  service_plan_id     = azurerm_service_plan.asp.id
  https_only          = true

  # Identidad administrada asignada por el sistema (Zero-credentials en código)
  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on           = true # Mantiene activo el servidor WebSocket sin suspensiones
    websockets_enabled  = true # Obligatorio para el módulo de mensajería (ws)
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled" # Seguridad: deshabilita FTP plano

    application_stack {
      node_version = "20-lts"
    }

    # Comando de arranque: ejecuta inicialización idempotente de BD y levanta Express
    app_command_line = "npm run db:init && node app.js"
  }

  app_settings = {
    # Variables de entorno Node.js
    "NODE_ENV"      = "production"
    "PORT"          = "8080"
    "WEBSITES_PORT" = "8080"
    "CORS_ORIGIN"   = var.cors_origin

    # Integración con Azure Application Insights (Telemetría y logs automáticos)
    "APPINSIGHTS_INSTRUMENTATIONKEY"             = azurerm_application_insights.appi.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING"      = azurerm_application_insights.appi.connection_string
    "ApplicationInsightsAgent_EXTENSION_VERSION" = "~3"

    # Referencias directas a Azure Key Vault (Key Vault References via Managed Identity)
    "DATABASE_URL"   = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.kv.name};SecretName=database-url)"
    "SESSION_SECRET" = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.kv.name};SecretName=session-secret)"

    # Almacenamiento Azure Blob Storage para subida de archivos (adjuntos/uploads)
    "AZURE_STORAGE_ACCOUNT_NAME"   = azurerm_storage_account.sa.name
    "AZURE_STORAGE_CONTAINER_NAME" = azurerm_storage_container.uploads.name
  }

  tags = local.common_tags
}
