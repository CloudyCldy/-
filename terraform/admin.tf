# =====================================================================
# (Opcional) VM de administración + Azure Bastion Developer (gratis)
# Sirve para entrar a la base privada con psql. Actívala con enable_admin_vm = true.
# =====================================================================
resource "tls_private_key" "admin" {
  count     = var.enable_admin_vm ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_sensitive_file" "admin_key" {
  count           = var.enable_admin_vm ? 1 : 0
  content         = tls_private_key.admin[0].private_key_pem
  filename        = "${path.module}/admin-vm-key.pem"
  file_permission = "0600"
}

resource "azurerm_network_interface" "admin" {
  count               = var.enable_admin_vm ? 1 : 0
  name                = "nic-vm-admin-${local.base}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags

  ip_configuration {
    name                          = "ipconfig1"
    subnet_id                     = azurerm_subnet.admin.id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_linux_virtual_machine" "admin" {
  count                           = var.enable_admin_vm ? 1 : 0
  name                            = "vm-admin-${local.base}"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  size                            = var.admin_vm_size
  admin_username                  = "azureuser"
  network_interface_ids           = [azurerm_network_interface.admin[0].id]
  disable_password_authentication = true

  admin_ssh_key {
    username   = "azureuser"
    public_key = tls_private_key.admin[0].public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  # Instala el cliente de PostgreSQL al crear la VM
  custom_data = base64encode(<<-CLOUD
    #cloud-config
    packages:
      - postgresql-client
  CLOUD
  )

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags

  depends_on = [azurerm_subnet_network_security_group_association.admin]
}

resource "azurerm_dev_test_global_vm_shutdown_schedule" "admin" {
  count                 = var.enable_admin_vm ? 1 : 0
  virtual_machine_id    = azurerm_linux_virtual_machine.admin[0].id
  location              = azurerm_resource_group.rg.location
  enabled               = true
  daily_recurrence_time = "2300"
  timezone              = "Central Standard Time (Mexico)"

  notification_settings {
    enabled = false
  }
}

resource "azurerm_bastion_host" "bastion" {
  count               = var.enable_admin_vm ? 1 : 0
  name                = "bas-${local.base}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Developer"
  virtual_network_id  = azurerm_virtual_network.vnet.id
  tags                = var.tags

  # Bastion falla si la VNet todavía se está modificando
  depends_on = [
    azurerm_subnet_network_security_group_association.app,
    azurerm_subnet_network_security_group_association.pe,
    azurerm_subnet_network_security_group_association.admin,
    azurerm_private_endpoint.pg,
    azurerm_linux_web_app.app,
  ]
}
