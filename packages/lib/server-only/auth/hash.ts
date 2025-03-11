import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { SALT_ROUNDS } from '../../constants/auth';

/**
 * @deprecated Use the methods built into `bcrypt` instead
 */
export const hashSync = (password: string) => {
  return bcrypt.hashSync(password, SALT_ROUNDS);
};

export const compareSync = (password: string, hash: string) => {
  return bcrypt.compareSync(password, hash);
};

export const hashString = (input: string) => {
  return crypto.createHash('sha512').update(input).digest('hex');
};
