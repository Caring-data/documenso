#!/bin/bash

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
SMTP_HOST="localhost"
SMTP_PORT="2500"
API_URL="http://localhost:9000"
FROM_EMAIL="mmeader@caringdata.com"
TO_EMAIL="kevinhurtado002@gmail.com"

echo -e "${BLUE}🚀 Iniciando prueba de Inbucket...${NC}\n"

# 1. Verificar que Inbucket esté funcionando (usando la página principal)
echo -e "${YELLOW}1. Verificando que Inbucket esté funcionando...${NC}"
if curl -s -f "$API_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Inbucket está funcionando${NC}"
elif curl -s "$API_URL/api/v1/mailbox" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Inbucket está funcionando (API disponible)${NC}"
else
    echo -e "${RED}❌ Inbucket no está disponible en $API_URL${NC}"
    exit 1
fi

# 2. Mostrar casillas existentes
echo -e "\n${YELLOW}2. Casillas de correo existentes:${NC}"
curl -s "$API_URL/api/v1/mailbox" 2>/dev/null || echo "Sin casillas aún"

# 3. Crear archivo temporal con el email
echo -e "\n${YELLOW}3. Preparando email de prueba...${NC}"
EMAIL_FILE=$(mktemp)
cat > "$EMAIL_FILE" << EOF
From: $FROM_EMAIL
To: $TO_EMAIL
Subject: Prueba de Inbucket - $(date)

Hola,

Este es un email de prueba enviado a Inbucket.
Timestamp: $(date)

Contenido del email:
- Enviado desde: $FROM_EMAIL
- Destinatario: $TO_EMAIL
- Servidor SMTP: $SMTP_HOST:$SMTP_PORT

¡Saludos desde el script de prueba!
EOF

echo -e "${GREEN}✅ Email preparado${NC}"

# 4. Enviar email via SMTP
echo -e "\n${YELLOW}4. Enviando email via SMTP...${NC}"
if curl --url "smtp://$SMTP_HOST:$SMTP_PORT" \
        --mail-from "$FROM_EMAIL" \
        --mail-rcpt "$TO_EMAIL" \
        --upload-file "$EMAIL_FILE" \
        --silent --show-error; then
    echo -e "${GREEN}✅ Email enviado exitosamente${NC}"
else
    echo -e "${RED}❌ Error al enviar email${NC}"
    rm "$EMAIL_FILE"
    exit 1
fi

# Limpiar archivo temporal
rm "$EMAIL_FILE"

# 5. Esperar un momento para que el email se procese
echo -e "\n${YELLOW}5. Esperando procesamiento del email...${NC}"
sleep 2

# 6. Verificar emails recibidos
echo -e "\n${YELLOW}6. Verificando emails capturados...${NC}"
USERNAME=$(echo "$TO_EMAIL" | cut -d'@' -f1)
RESPONSE=$(curl -s "$API_URL/api/v1/mailbox/$USERNAME")

if echo "$RESPONSE" | grep -q "Date\|Subject\|Id" 2>/dev/null; then
    echo -e "${GREEN}✅ Email capturado correctamente${NC}"
    echo -e "\n${BLUE}📧 Detalles del email:${NC}"
    echo "$RESPONSE"
else
    echo -e "${YELLOW}ℹ️  Respuesta del servidor:${NC}"
    echo "$RESPONSE"
fi

# 7. Mostrar información útil
echo -e "\n${BLUE}🌐 URLs útiles:${NC}"
echo -e "   Interfaz web: $API_URL"
echo -e "   API mailbox: $API_URL/api/v1/mailbox"
echo -e "   Casilla específica: $API_URL/api/v1/mailbox/$USERNAME"

echo -e "\n${GREEN}🎉 Prueba completada${NC}"