# =====================================================================
# Observabilidad: Log Analytics + Application Insights
# =====================================================================
resource "azurerm_log_analytics_workspace" "law" {
  name                = "log-${local.base}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.15 # ~5 GB/mes, dentro de lo gratuito
  tags                = var.tags
}

resource "azurerm_application_insights" "appi" {
  name                = "appi-${local.base}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "Node.JS"
  tags                = var.tags
}

# Logs de consola y HTTP del App Service hacia Log Analytics
resource "azurerm_monitor_diagnostic_setting" "app" {
  name                       = "diag-app-${local.base}"
  target_resource_id         = azurerm_linux_web_app.app.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

  enabled_log {
    category = "AppServiceConsoleLogs"
  }
  enabled_log {
    category = "AppServiceHTTPLogs"
  }
  enabled_log {
    category = "AppServiceAppLogs"
  }
}

# Logs de PostgreSQL hacia Log Analytics
resource "azurerm_monitor_diagnostic_setting" "pg" {
  name                       = "diag-psql-${local.base}"
  target_resource_id         = azurerm_postgresql_flexible_server.pg.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

  enabled_log {
    category = "PostgreSQLLogs"
  }
}

# Alertas de presupuesto (opcional)
resource "azurerm_consumption_budget_resource_group" "budget" {
  count             = var.enable_budget ? 1 : 0
  name              = "budget-${local.base}"
  resource_group_id = azurerm_resource_group.rg.id
  amount            = 90
  time_grain        = "Monthly"

  time_period {
    start_date = var.budget_start_date
  }

  dynamic "notification" {
    for_each = { "50" = 55, "75" = 83, "90" = 100 } # 50, 75 y 90 USD sobre 90
    content {
      enabled        = true
      threshold      = notification.value
      operator       = "GreaterThanOrEqualTo"
      threshold_type = "Actual"
      contact_emails = [var.budget_alert_email]
    }
  }
}
