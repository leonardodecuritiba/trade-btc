import * as jwt from 'jsonwebtoken';
import { IJwtService } from '../../../../packages/application/src/use-cases';

export class JwtTokenService implements IJwtService {
  constructor(private readonly secret: string) {}

  async sign(payload: object, expiresIn: string): Promise<string> {
    const token = jwt.sign(
      payload as jwt.JwtPayload,
      this.secret as jwt.Secret,
      { expiresIn } as jwt.SignOptions
    );
    return token;
  }
}
