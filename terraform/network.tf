# =====================================================================
# Red virtual vnet-haitani-prod (10.0.0.0/16)
# =====================================================================
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-${local.base}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = var.vnet_address_space
  tags                = var.tags
}

# snet-app: salida del App Service hacia la VNet (VNet Integration)
resource "azurerm_subnet" "app" {
  name                 = "snet-app"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [var.subnet_prefixes.app]

  delegation {
    name = "delegation-web"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# snet-pe: Private Endpoint de PostgreSQL
resource "azurerm_subnet" "pe" {
  name                              = "snet-pe"
  resource_group_name               = azurerm_resource_group.rg.name
  virtual_network_name              = azurerm_virtual_network.vnet.name
  address_prefixes                  = [var.subnet_prefixes.pe]
  private_endpoint_network_policies = "Enabled" # para que el NSG aplique al endpoint
}

# snet-admin: VM de administración (solo se usa si enable_admin_vm = true)
resource "azurerm_subnet" "admin" {
  name                 = "snet-admin"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [var.subnet_prefixes.admin]
}

# =====================================================================
# NSGs
# =====================================================================
resource "azurerm_network_security_group" "app" {
  name                = "nsg-app"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_network_security_group" "pe" {
  name                = "nsg-pe"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags

  security_rule {
    name                       = "Allow-Postgres-From-App"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = var.subnet_prefixes.app
    destination_address_prefix = var.subnet_prefixes.pe
  }

  security_rule {
    name                       = "Allow-Postgres-From-Admin"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = var.subnet_prefixes.admin
    destination_address_prefix = var.subnet_prefixes.pe
  }

  security_rule {
    name                       = "Deny-VNet-Inbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_security_group" "admin" {
  name                = "nsg-admin"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags

  # Bastion Developer entra desde la IP de plataforma 168.63.129.16
  security_rule {
    name                       = "Allow-SSH-From-Bastion"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "168.63.129.16"
    destination_address_prefix = var.subnet_prefixes.admin
  }

  # Azure no permite mezclar IPs y etiquetas en una misma regla
  security_rule {
    name                       = "Allow-SSH-From-VNet"
    priority                   = 105
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = var.subnet_prefixes.admin
  }

  security_rule {
    name                       = "Deny-SSH-Internet"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "app" {
  subnet_id                 = azurerm_subnet.app.id
  network_security_group_id = azurerm_network_security_group.app.id
}

resource "azurerm_subnet_network_security_group_association" "pe" {
  subnet_id                 = azurerm_subnet.pe.id
  network_security_group_id = azurerm_network_security_group.pe.id
}

resource "azurerm_subnet_network_security_group_association" "admin" {
  subnet_id                 = azurerm_subnet.admin.id
  network_security_group_id = azurerm_network_security_group.admin.id
}

# =====================================================================
# DNS privado: psql-...postgres.database.azure.com -> IP privada
# =====================================================================
resource "azurerm_private_dns_zone" "postgres" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "link-postgres-${local.base}"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
  registration_enabled  = false
  tags                  = var.tags
}
