import { User } from '../../../domain/src/user';
import { AppError } from '../../../shared/src/errors';

// Adapters Port
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt'>, account: { fiatBalanceBRL: number }): Promise<User>;
}

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

// DTOs
export interface RegisterUserRequest {
  name: string;
  email: string;
  password: string;
}

export class RegisterUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordHasher: IPasswordHasher
  ) {}

  async execute(data: RegisterUserRequest): Promise<Pick<User, 'id' | 'name' | 'email'>> {
    const { name, email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();
    const emailTaken = await this.userRepository.findByEmail(normalizedEmail);
    if (emailTaken) {
      throw new AppError(409, "EMAIL_TAKEN", "Email already in use.");
    }
    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.userRepository.create(
      { name, email: normalizedEmail, passwordHash },
      { fiatBalanceBRL: 0 }
    );
    return { id: user.id, name: user.name, email: user.email };
  }
}
