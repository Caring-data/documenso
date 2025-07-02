import fetch from 'node-fetch';

const NOTIFY_ENDPOINT = process.env.NEXT_PRIVATE_NOTIFY_ENDPOINT;
const NOTIFY_EMAIL = process.env.NEXT_PRIVATE_NOTIFY_EMAIL;
const NOTIFY_PASSWORD = process.env.NEXT_PRIVATE_NOTIFY_PASSWORD;

interface EmailRecipient {
  name?: string;
  email: string;
}

interface EmailRequestBody {
  mailTo: string;
  subject: string;
  richContent: string;
  attachments?: {
    filename: string;
    content: string;
  }[];
}

export const sendEmail = async (to: EmailRecipient, subject: string, html: string) => {
  try {
    if (!NOTIFY_ENDPOINT || !NOTIFY_EMAIL || !NOTIFY_PASSWORD) {
      throw new Error('Faltan credenciales de Notify en el .env');
    }

    const url = `${NOTIFY_ENDPOINT}sendImmediateEmailNotification?login=${NOTIFY_EMAIL}&password=${NOTIFY_PASSWORD}`;

    const body: EmailRequestBody = {
      mailTo: to.email,
      subject,
      richContent: html,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Error al enviar el correo: ${response.statusText}`);
    }

    return { success: true, message: 'Correo enviado exitosamente' };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return { success: false, message: error };
  }
};
