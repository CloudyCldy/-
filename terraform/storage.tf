# ==============================================================================
# Capa de Almacenamiento de Archivos - Azure Blob Storage
# Reemplaza la carpeta local ./uploads por persistencia duradera y económica
# ==============================================================================

resource "azurerm_storage_account" "sa" {
  name                     = local.storage_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS" # Locally-Redundant Storage (El más económico)
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"

  # Seguridad: Evitar acceso anónimo directo a la cuenta de almacenamiento
  allow_nested_items_to_be_public = false

  tags = local.common_tags
}

# Contenedor privado para almacenar archivos adjuntos de las tareas y proyectos
resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.sa.name
  container_access_type = "private"
}
