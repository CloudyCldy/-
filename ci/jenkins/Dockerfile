# DO-06 · Imagen de Jenkins para el QA automático de Haitani.
# Trae Node.js 22 (pruebas), cliente de PostgreSQL (base de pruebas), gitleaks (llaves en el código),
# los plugins de plugins.txt y la configuración como código (casc.yaml): no hay que configurar nada a mano.
FROM jenkins/jenkins:lts-jdk21

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git zip gnupg postgresql-client \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && curl -fsSL https://github.com/gitleaks/gitleaks/releases/download/v8.28.0/gitleaks_8.28.0_linux_x64.tar.gz \
    | tar -xz -C /usr/local/bin gitleaks \
 && rm -rf /var/lib/apt/lists/* \
 && node --version && gitleaks version

USER jenkins
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY --chown=jenkins:jenkins casc.yaml /usr/share/jenkins/casc.yaml

ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false -Duser.timezone=America/Mexico_City" \
    CASC_JENKINS_CONFIG=/usr/share/jenkins/casc.yaml
