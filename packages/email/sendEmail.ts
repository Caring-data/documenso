import type { NextApiRequest, NextApiResponse } from 'next';

import { sendEmail } from './transports/notifyService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Faltan parámetros en la solicitud' });
  }

  const response = await sendEmail(to, subject, body);

  if (!response.success) {
    return res.status(500).json({ error: response.message });
  }

  res.status(200).json({ message: 'Correo enviado exitosamente' });
}
