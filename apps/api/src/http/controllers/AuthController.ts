import { Request, Response } from 'express';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import { LoginUseCase, RegisterUserUseCase } from '../../../../../packages/application/src/use-cases';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export class AuthController {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private loginUseCase: LoginUseCase
  ) {}

  async register(req: Request, res: Response): Promise<Response> {
    const data = registerSchema.parse(req.body);
    const user = await this.registerUserUseCase.execute(data);
    return res.status(201).json(user);
  }

  async login(req: Request, res: Response): Promise<Response> {
    const data = loginSchema.parse(req.body);
    const result = await this.loginUseCase.execute(data);
    try {
      const decoded = jwt.verify(result.token, (process.env.JWT_SECRET || 'supersecret')) as jwt.JwtPayload;
      if (decoded && typeof decoded.sub === 'string') {
        res.locals.userId = decoded.sub;
        if (res.locals.logger) {
          res.locals.logger.info({ userId: decoded.sub }, 'login success');
        }
      }
    } catch {
      // ignore decode failures here
    }
    return res.status(200).json(result);
  }
}
