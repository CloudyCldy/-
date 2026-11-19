// DO-06 · Pipeline de pre-producción de Haitani (QA automático con Jenkins)
//
// Flujo (como el diagrama del equipo):
//   rama feat/HB-xx --PR (GitHub Actions)--> dev --Jenkins--> QA / pre-producción --Jenkins--> main --Render--> producción
//
//   Cada cambio nuevo en dev (Jenkins revisa dev cada 5 minutos) hace todo el camino solo:
//   dev pasa a QA (pre-producción) -> Jenkins analiza QA: pruebas con JUnit, cobertura, código hardcodeado
//   y la API levantada sin errores -> si todo pasa, QA pasa a main solo -> Render publica producción.
//   El botón "Construir con parámetros" > PROMOVER_AHORA hace lo mismo a mano.
//   Si una etapa falla, el pipeline se detiene, main no cambia, el commit queda con un tache en GitHub y
//   en Jenkins "Test Result" (JUnit) dice qué prueba o qué archivo falló.
//
// Credenciales (Administrar Jenkins > Credentials), nunca en el código:
//   github-token     Usuario y token de GitHub con permiso para hacer push a QA y main.
//   ci-db-password   Contraseña del PostgreSQL de pruebas de Jenkins.

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timeout(time: 60, unit: 'MINUTES')
  }

  triggers {
    pollSCM('H/5 * * * *')
    // Opcional: ventana de despliegue a una hora fija. Ejemplo, todos los días a las 22:00 de México:
    // cron('''TZ=America/Mexico_City
    // 0 22 * * *''')
  }

  parameters {
    booleanParam(
      name: 'PROMOVER_AHORA',
      defaultValue: false,
      description: 'Forzar a mano lo que Jenkins hace solo con cada cambio: pasar dev a QA, analizarlo y, si todo pasa, subirlo a main.'
    )
  }

  environment {
    GITHUB_REPO      = 'CloudyCldy/-'
    PROD_URL         = 'https://rwq70fnfjj.onrender.com'
    CI_DB_HOST       = 'postgres'
    COBERTURA_MINIMA = '55'
  }

  stages {
    stage('Preparar') {
      steps {
        script {
          env.ETAPA = 'Preparar'
          env.SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
          def porCambio  = !currentBuild.getBuildCauses('hudson.triggers.SCMTrigger$SCMTriggerCause').isEmpty()
          def porVentana = !currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause').isEmpty()
          env.PROMOVER = (porCambio || porVentana || params.PROMOVER_AHORA) ? 'true' : 'false'

          if (env.PROMOVER == 'true') {
            withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
              sh 'git fetch -q "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "+refs/heads/main:refs/remotes/origin/main"'
            }
            if (sh(script: 'git merge-base --is-ancestor "$SHA" origin/main', returnStatus: true) == 0) {
              echo "main ya tiene el commit ${env.SHA.take(7)} de dev: no hay cambios nuevos que subir."
              env.PROMOVER = 'false'
            }
          }

          def tipo = porCambio ? 'Cambio nuevo en dev' : (params.PROMOVER_AHORA ? 'Promoción manual' : (porVentana ? 'Ventana de despliegue' : 'Análisis'))
          currentBuild.description = "${tipo} · dev ${env.SHA.take(7)}" + (env.PROMOVER == 'true' ? ' · dev → QA → main' : '')
          echo "Tipo de ejecución: ${tipo}. Commit de dev: ${env.SHA}. Promover: ${env.PROMOVER}"
        }
        withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
          sh 'bash ci/scripts/estado_github.sh "$SHA" pending "Jenkins está analizando el commit"'
        }
      }
    }

    stage('Pre-producción: dev pasa a QA') {
      when { environment name: 'PROMOVER', value: 'true' }
      steps {
        script { env.ETAPA = 'Pre-producción: dev pasa a QA' }
        withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
          sh 'bash ci/scripts/promover.sh QA "$SHA"'
        }
        script { env.QA_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim() }
      }
    }

    stage('Análisis') {
      parallel {
        stage('Pruebas, JUnit y cobertura') {
          steps {
            script { env.ETAPA = 'Pruebas, JUnit y cobertura' }
            sh 'npm ci --no-audit --no-fund'
            withCredentials([string(credentialsId: 'ci-db-password', variable: 'CI_DB_PASSWORD')]) {
              sh 'bash ci/scripts/pruebas.sh'
            }
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'reports/junit.xml'
              recordCoverage(tools: [[parser: 'COBERTURA', pattern: 'reports/coverage/cobertura-coverage.xml']])
            }
          }
        }
        stage('Código hardcodeado y llaves') {
          steps {
            script { env.ETAPA = 'Código hardcodeado y llaves' }
            sh 'bash ci/scripts/secretos.sh'
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'reports/secretos.xml'
            }
          }
        }
      }
    }

    stage('API sin errores') {
      steps {
        script { env.ETAPA = 'API sin errores' }
        withCredentials([string(credentialsId: 'ci-db-password', variable: 'CI_DB_PASSWORD')]) {
          sh 'bash ci/scripts/api_local.sh'
        }
      }
    }

    stage('Producción: QA pasa a main') {
      when { environment name: 'PROMOVER', value: 'true' }
      steps {
        script { env.ETAPA = 'Producción: QA pasa a main' }
        withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
          sh 'bash ci/scripts/promover.sh main "$QA_SHA" QA'
        }
      }
    }

    stage('Producción: Render publica') {
      when { environment name: 'PROMOVER', value: 'true' }
      steps {
        script { env.ETAPA = 'Producción: Render publica' }
        echo 'Render detecta el cambio en main (Auto-Deploy) y publica. Se espera a que el servicio responda.'
        sleep time: 90, unit: 'SECONDS'
        sh 'bash ci/scripts/smoke.sh "$PROD_URL" 30'
      }
    }
  }

  post {
    success {
      withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
        sh '''
          if [ "$PROMOVER" = "true" ]; then msg="Aprobado en QA y publicado en producción"; else msg="Análisis aprobado: pruebas, llaves y API"; fi
          bash ci/scripts/estado_github.sh "$SHA" success "$msg"
        '''
      }
    }
    failure {
      withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
        sh 'bash ci/scripts/estado_github.sh "$SHA" failure "Falló en: ${ETAPA}. Revisa Test Result y el log del build"'
      }
      echo "El pipeline se detuvo en la etapa: ${env.ETAPA}. main no cambió."
    }
    always {
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
    }
  }
}
