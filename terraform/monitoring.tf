# ==============================================================================
# Capa de Monitoreo y Control de Presupuesto (FinOps Estudiantil)
# Log Analytics (Límite 5 GB gratis), Application Insights y Alertas de Costos
# ==============================================================================

# Espacio de trabajo de Log Analytics con cuota diaria de seguridad
resource "azurerm_log_analytics_workspace" "law" {
  name                = local.log_analytics_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.16 # ~5 GB/mes (Garantiza costo $0 de ingesta dentro de la capa gratuita)

  tags = local.common_tags
}

# Application Insights para telemetría de Express, WebSockets, latencia y errores 5xx
resource "azurerm_application_insights" "appi" {
  name                = local.app_insights_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "Node.JS"

  tags = local.common_tags
}

# Alerta de Presupuesto en el Grupo de Recursos para proteger los créditos de Azure for Students
resource "azurerm_consumption_budget_resource_group" "budget" {
  name              = "budget-${var.project_name}-students"
  resource_group_id = azurerm_resource_group.rg.id

  amount     = var.budget_amount # Límite en USD ($100 por defecto)
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00'Z'", timestamp())
  }

  # Notificación al alcanzar el 50% ($50 USD)
  notification {
    enabled        = true
    threshold      = 50.0
    operator       = "GreaterThan"
    threshold_type = "Actual"
    contact_emails = [var.alert_email]
  }

  # Notificación al alcanzar el 75% ($75 USD)
  notification {
    enabled        = true
    threshold      = 75.0
    operator       = "GreaterThan"
    threshold_type = "Actual"
    contact_emails = [var.alert_email]
  }

  # Notificación al alcanzar el 90% ($90 USD) - Alerta de apagado preventivo
  notification {
    enabled        = true
    threshold      = 90.0
    operator       = "GreaterThan"
    threshold_type = "Actual"
    contact_emails = [var.alert_email]
  }

  lifecycle {
    ignore_changes = [time_period]
  }
}
