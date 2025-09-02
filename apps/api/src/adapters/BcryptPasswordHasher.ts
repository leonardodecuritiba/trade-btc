import bcrypt from 'bcrypt';
import { IPasswordHasher } from '../../../../packages/application/src/use-cases';

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds = Number(process.env.BCRYPT_COST || 12);

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
