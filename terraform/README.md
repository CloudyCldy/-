# Despliegue de Infraestructura en Azure con Terraform
## Proyecto Haitani (Sakura Coffee Operations) - Azure for Students

Este directorio contiene la definición completa de **Infraestructura como Código (IaC)** en Terraform para aprovisionar la arquitectura en la nube de Azure, optimizada para los créditos del programa **Azure for Students** (\$100 USD).

---

## 🏛️ Recursos Aprovisionados

| Componente | Recurso Azure | SKU / Nivel | Propósito |
| :--- | :--- | :--- | :--- |
| **Cómputo** | Azure App Service (Linux) | `B1` (Basic) | Ejecución de Node.js 20 LTS, soporte nativo de WebSockets (`ws`), certificados TLS y Always-On. |
| **Base de Datos** | Azure Database for PostgreSQL Flexible | `Standard_B1ms` | Motor relacional PostgreSQL 16 con SSL obligatorio y disco controlado (32 GB sin auto-grow). |
| **Archivos** | Azure Blob Storage | `Standard_LRS` (Hot) | Persistencia duradera de archivos adjuntos y subidas (`uploads`), sustituyendo el almacenamiento local efímero. |
| **Seguridad** | Azure Key Vault | `Standard` | Custodia de credenciales (`DATABASE_URL`, `SESSION_SECRET`) consumidas vía **System-Assigned Managed Identity**. |
| **Monitoreo** | App Insights & Log Analytics | `PerGB2018` | Telemetría de la app con cuota diaria fija (0.16 GB/día) para garantizar costo $0 de ingesta (límite 5 GB/mes). |
| **FinOps** | Azure Cost Management Budget | N/A | Alertas por correo al 50%, 75% y 90% del presupuesto de estudiantes para evitar sobregiros. |

---

## 📋 Requisitos Previos

1. **Azure CLI**: Tener instalado el CLI de Azure y haber iniciado sesión:
   ```bash
   az login
   az account set --subscription "<NOMBRE_O_ID_DE_TU_SUSCRIPCION_STUDENTS>"
   ```
2. **Terraform CLI**: Versión `>= 1.5.0` instalada.
3. **Credenciales**: Definir las variables en el archivo de configuración local.

---

## 🚀 Guía de Despliegue Paso a Paso

### 1. Preparar las variables
Copia el archivo de ejemplo `terraform.tfvars.example` como `terraform.tfvars`:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edita `terraform.tfvars` con tus credenciales seguras y tu correo estudiantil.

### 2. Inicializar los proveedores
Descarga el proveedor de Azure (`azurerm`) y módulos necesarios:
```bash
terraform init
```

### 3. Validar y planificar
Revisa los recursos que se van a crear sin alterar la nube:
```bash
terraform plan
```

### 4. Aplicar la infraestructura
Despliega los recursos en tu suscripción de Azure:
```bash
terraform apply
```
Confirma escribiendo `yes` cuando se te solicite.

### 5. Consultar los endpoints
Al finalizar, Terraform mostrará los valores de salida:
- **URL pública de la aplicación:** `https://haitani-app-xxxx.azurewebsites.net`
- **Servidor PostgreSQL:** `haitani-psql-xxxx.postgres.database.azure.com`
- **Almacén Key Vault:** `https://haitani-kv-xxxx.vault.azure.net/`

---

## 💡 Consejos de Ahorro para Estudiantes (FinOps)

1. **Detener PostgreSQL fuera de horas de prueba:**
   - La base de datos es el recurso que más consume (~$12 USD/mes si corre 24/7). Puedes detener el servidor desde el Portal de Azure o vía Azure CLI en fines de semana o vacaciones:
     ```bash
     az postgres flexible-server stop --resource-group rg-haitani-prod --name <nombre-servidor>
     ```
   - Al estar detenido, solo pagas centavos por el almacenamiento del disco.
2. **Destruir los recursos al finalizar la evaluación:**
   - Para no gastar créditos innecesariamente una vez calificada la entrega:
     ```bash
     terraform destroy
     ```
   - Escribe `yes` para confirmar la eliminación completa y limpia de todos los recursos.
