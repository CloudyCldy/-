# ---------------- General ----------------
variable "subscription_id" {
  description = "ID de la suscripción Azure for Students"
  type        = string
}

variable "location" {
  description = "Región. Mexico Central está bloqueada en Azure for Students; North Central US sí está permitida."
  type        = string
  default     = "northcentralus"
}

variable "project" {
  type    = string
  default = "haitani"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "tags" {
  type = map(string)
  default = {
    proyecto    = "haitani"
    escuela     = "UTVT"
    environment = "prod"
    managed_by  = "terraform"
  }
}

# ---------------- Red ----------------
variable "vnet_address_space" {
  type    = list(string)
  default = ["10.0.0.0/16"]
}

variable "subnet_prefixes" {
  type = map(string)
  default = {
    app   = "10.0.1.0/24" # VNet Integration del App Service
    pe    = "10.0.2.0/24" # Private Endpoints (PostgreSQL)
    admin = "10.0.3.0/24" # VM de administración (opcional)
  }
}

# ---------------- App Service ----------------
variable "node_version" {
  description = "Versión LTS de Node.js para App Service Linux"
  type        = string
  default     = "22-lts"
}

variable "existing_service_plan_id" {
  description = "ID de un plan de App Service Linux existente para reutilizarlo (opcional). Si es null se crea un plan B1 nuevo."
  type        = string
  default     = null
}

variable "extra_app_settings" {
  description = "Variables de entorno NO secretas de la app (ej. SANZU_API_URL, SANDBOX_MODE)"
  type        = map(string)
  default     = {}
}

variable "app_secrets" {
  description = "Variables secretas de la app. Se guardan en Key Vault y la app las lee como referencia. Ej: { SANZU_API_KEY = \"...\" }"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# ---------------- PostgreSQL ----------------
variable "pg_admin_user" {
  type    = string
  default = "haitaniadmin"
}

variable "pg_version" {
  type    = string
  default = "16"
}

variable "pg_database_name" {
  type    = string
  default = "haitani"
}

# ---------------- Opcionales ----------------
variable "enable_admin_vm" {
  description = "Crea una VM Linux pequeña + Azure Bastion Developer (gratis) para administrar la base privada con psql."
  type        = bool
  default     = false
}

variable "admin_vm_size" {
  type    = string
  default = "Standard_B2ats_v2"
}

variable "enable_budget" {
  description = "Crea alertas de presupuesto (50/75/90 USD) sobre el grupo de recursos. Algunas suscripciones de estudiante no lo permiten."
  type        = bool
  default     = false
}

variable "budget_alert_email" {
  type    = string
  default = ""
}

variable "budget_start_date" {
  description = "Primer día del mes en formato RFC3339"
  type        = string
  default     = "2026-11-01T00:00:00Z"
}
