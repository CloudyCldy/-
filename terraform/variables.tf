# ==============================================================================
# Variables de Entrada - Entorno Académico Azure for Students
# ==============================================================================

variable "project_name" {
  description = "Prefijo base para nombrar los recursos"
  type        = string
  default     = "haitani"
}

variable "environment" {
  description = "Nombre del ambiente desplegado"
  type        = string
  default     = "prod"
}

variable "resource_suffix" {
  description = "Sufijo alfanumérico para garantizar nombres únicos en Azure (letras y números, sin guiones)"
  type        = string
  default     = "std01"
}

variable "location" {
  description = "Región de Azure recomendada por costo y disponibilidad para estudiantes (East US o East US 2)"
  type        = string
  default     = "eastus2"
}

variable "resource_group_name" {
  description = "Nombre del Resource Group centralizado"
  type        = string
  default     = "rg-haitani-prod"
}

# --- Base de Datos PostgreSQL ---
variable "db_admin_username" {
  description = "Usuario administrador de PostgreSQL Flexible Server"
  type        = string
  default     = "haitaniadmin"
}

variable "db_admin_password" {
  description = "Contraseña del administrador de PostgreSQL (mínimo 8 caracteres, mayúsculas, minúsculas y números)"
  type        = string
  sensitive   = true
}

# --- Configuración de la Aplicación ---
variable "session_secret" {
  description = "Secreto de cifrado para las sesiones express-session / connect-pg-simple"
  type        = string
  sensitive   = true
}

variable "cors_origin" {
  description = "Orígenes permitidos para CORS (usar dominio de frontend o * si es monolito)"
  type        = string
  default     = "*"
}

# --- Monitoreo y Presupuesto ---
variable "alert_email" {
  description = "Correo electrónico del estudiante para recibir alertas de presupuesto y caídas de servicio"
  type        = string
}

variable "budget_amount" {
  description = "Monto límite en USD para el presupuesto (por defecto $100 USD de Azure for Students)"
  type        = number
  default     = 100
}

variable "extra_tags" {
  description = "Etiquetas adicionales opcionales para los recursos"
  type        = map(string)
  default     = {}
}
