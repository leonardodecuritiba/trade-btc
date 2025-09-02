import { AppError } from '../../../shared/src/errors';
import { IPasswordHasher, IUserRepository } from './register-user';

// Adapters Port
export interface IJwtService {
  sign(payload: object, expiresIn: string): Promise<string>;
}

// DTOs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: string;
}

export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private jwtService: IJwtService
  ) {}

  async execute(data: LoginRequest): Promise<LoginResponse> {
    const { email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    const isPasswordValid = await this.passwordHasher.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    const minutes = Number(process.env.JWT_TTL_MIN || 15);
    const expiresIn = `${minutes}m`;
    const token = await this.jwtService.sign({ sub: user.id }, expiresIn);
    return { token, expiresIn };
  }
}
