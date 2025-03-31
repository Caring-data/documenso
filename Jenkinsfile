pipeline {
    agent { label 'cd_production' }

    environment {
        PROJECT_NAME = "documenso"
        REPO_URL = "https://github.com/Caring-data/documenso"
        CONTAINER_NAME = "documenso_container"
        NGINX_CONTAINER_NAME = "nginx_next"
    }

    stages {
        stage('Prepare Workspace') {
            steps {
                script {
                    sh 'whoami'
                }
            }
        }
        stage('Checkout') {
            steps {
                checkout([$class: 'GitSCM',
                          branches: [[name: '*/main']],
                          userRemoteConfigs: [[
                              url: "${REPO_URL}",
                              credentialsId: 'git_credentials'
                          ]]])
            }
        }
        stage('Copy .env') {
            steps {
                script {
                    sh """
                        if [ -f "${JENKINS_HOME}/workspace/documenso_production/.env" ]; then
                            sudo rm -f ${JENKINS_HOME}/workspace/documenso_production/.env
                        fi
                    """
                    sh 'sudo cp /home/caringdata/production/documenso/.env ${JENKINS_HOME}/workspace/documenso_production/.env'
                }
            }
        }
        stage('Build and Start Docker Compose Services') {
            steps {
                script {
                    sh 'cd ${JENKINS_HOME}/workspace/documenso_production'

                    // Stop and remove any existing containers (if they exist)
                    sh """
                        docker compose down || true
                    """

                    // Build and start both services using docker-compose
                    sh """
                        docker compose up -d --build
                    """
                }
            }
        }
    }
}
