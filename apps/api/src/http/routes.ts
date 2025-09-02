import { Router } from 'express';
import { PrismaUserRepository } from '../adapters/PrismaUserRepository';
import { BcryptPasswordHasher } from '../adapters/BcryptPasswordHasher';
import { JwtTokenService } from '../adapters/JwtTokenService';
import { AuthController } from './controllers/AuthController';
import { prisma } from '../lib/prisma';
import { rateLimit } from '../middleware/rateLimit';
import { RegisterUserUseCase, LoginUseCase } from '../../../../packages/application/src/use-cases';
import { authGuard } from '../middleware/authGuard';
import { getRedis } from '../lib/redis';
import { DepositUseCase } from '../../../../packages/application/src/use-cases/deposit';
import { PrismaDepositRepository } from '../adapters/PrismaDepositRepository';
import { PrismaUserReader } from '../adapters/PrismaUserReader';
import { SendgridEmailService } from '../adapters/SendgridEmailService';
import { DepositController } from './controllers/DepositController';
import { PrismaAccountRepository } from '../adapters/PrismaAccountRepository';
import { GetBalanceUseCase } from '../../../../packages/application/src/use-cases/get-balance';
import { BalanceController } from './controllers/BalanceController';
import { GetCurrentQuoteUseCase } from '../../../../packages/application/src/use-cases/get-current-quote';
import { QuotesController } from './controllers/QuotesController';
import { RedisQuoteCache } from '../adapters/quotes/RedisQuoteCache';
import { StubQuoteProvider } from '../adapters/quotes/StubQuoteProvider';
import { MercadoBitcoinProvider } from '../adapters/quotes/MercadoBitcoinProvider';
import { PrismaPositionRepository } from '../adapters/PrismaPositionRepository';
import { GetPositionsUseCase } from '../../../../packages/application/src/use-cases/get-positions';
import { PositionsController } from './controllers/PositionsController';
import { OrdersController } from './controllers/OrdersController';
import { BuyBTCUseCase } from '../../../../packages/application/src/use-cases/buy-btc';
import { PrismaOrderRepository } from '../adapters/PrismaOrderRepository';
import { PrismaBuyRepository } from '../adapters/PrismaBuyRepository';
import { SellBTCUseCase } from '../../../../packages/application/src/use-cases/sell-btc';
import { PrismaSellRepository } from '../adapters/PrismaSellRepository';
import { PrismaSellOrderRepository } from '../adapters/PrismaSellOrderRepository';
import { PrismaTransactionRepository } from '../adapters/PrismaTransactionRepository';
import { GetStatementUseCase } from '../../../../packages/application/src/use-cases/get-statement';
import { StatementController } from './controllers/StatementController';
import { PrismaDailyVolumeRepository } from '../adapters/PrismaDailyVolumeRepository';
import { GetDailyVolumeUseCase } from '../../../../packages/application/src/use-cases/get-daily-volume';
import { MetricsController } from './controllers/MetricsController';
import { PrismaQuoteHistoryRepository } from '../adapters/PrismaQuoteHistoryRepository';
import { GetHistory24hUseCase } from '../../../../packages/application/src/use-cases/get-history-24h';
import { HistoryController } from './controllers/HistoryController';

const router: Router = Router();
const userRepository = new PrismaUserRepository(prisma);
const passwordHasher = new BcryptPasswordHasher();
const jwtService = new JwtTokenService(process.env.JWT_SECRET || 'supersecret');

const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
const loginUseCase = new LoginUseCase(userRepository, passwordHasher, jwtService);

const authController = new AuthController(registerUserUseCase, loginUseCase);

// Redis client (shared) for rate-limiting
const redis = getRedis();

// Per-route limits (defaults can be tuned via env)
const windowSec = Number(process.env.RATE_LIMIT_WINDOW_SEC || 60);
const maxLogin = Number(process.env.RATE_LIMIT_MAX_LOGIN || 10);
const maxRegister = Number(process.env.RATE_LIMIT_MAX_REGISTER || 10);

router.post(
  '/auth/register',
  rateLimit({
    client: redis,
    windowSec,
    max: maxRegister,
    key: (req) => `rl:register:${req.ip}`,
  }),
  (req, res, next) => authController.register(req, res).catch(next)
);

router.post(
  '/auth/login',
  rateLimit({
    client: redis,
    windowSec,
    max: maxLogin,
    key: (req) => `rl:login:${req.ip}`,
  }),
  (req, res, next) => authController.login(req, res).catch(next)
);

// Deposits (protected)
const depositRepo = new PrismaDepositRepository(prisma);
const userReader = new PrismaUserReader(prisma);
const emailService = new SendgridEmailService();
const depositUseCase = new DepositUseCase(depositRepo, userReader, emailService);
const depositController = new DepositController(depositUseCase);

const maxDeposits = Number(process.env.RATE_LIMIT_MAX_DEPOSITS || 20);
router.post(
  '/deposits',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxDeposits,
    key: (req) => `rl:deposits:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => depositController.create(req, res).catch(next)
);

// Balance (protected)
const accountRepo = new PrismaAccountRepository(prisma);
const getBalanceUseCase = new GetBalanceUseCase(accountRepo);
const balanceController = new BalanceController(getBalanceUseCase);
const maxBalance = Number(process.env.RATE_LIMIT_MAX_BALANCE || 60);
router.get(
  '/balance',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxBalance,
    key: (req) => `rl:balance:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => balanceController.show(req, res).catch(next)
);

// Quotes (protected) - choose provider at request time to honor test env changes
const quotesCache = new RedisQuoteCache(redis as any);
const maxQuotes = Number(process.env.RATE_LIMIT_MAX_QUOTES || 120);
router.get(
  '/quotes/current',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxQuotes,
    key: (req) => `rl:quotes:${(req as any).user?.id || req.ip}`,
  }),
  async (req, res, next) => {
    try {
      const provider = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub'
        ? new StubQuoteProvider()
        : new MercadoBitcoinProvider();
      const uc = new GetCurrentQuoteUseCase(quotesCache, provider);
      const controller = new QuotesController(uc);
      await controller.current(req, res);
    } catch (err) {
      next(err);
    }
  }
);

// Positions (protected) - uses single snapshot buy for all lines
const positionsRepo = new PrismaPositionRepository(prisma);
const positionsQuoteService = {
  getBuy: async (): Promise<{ priceBRL: number; ts: string }> => {
    const provider = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub'
      ? new StubQuoteProvider()
      : new MercadoBitcoinProvider();
    const uc = new GetCurrentQuoteUseCase(new RedisQuoteCache(redis as any), provider);
    try {
      const dto = await uc.execute();
      return { priceBRL: dto.buy, ts: dto.ts };
    } catch (err: any) {
      // Map quote unavailability to spec-specific code
      const { AppError } = await import('../../../../packages/shared/src/errors');
      if (err && err.status === 503) {
        throw new AppError(503, 'POSITION_PRICE_UNAVAILABLE', 'Position price unavailable');
      }
      throw err;
    }
  }
};
const getPositionsUC = new GetPositionsUseCase(positionsRepo, positionsQuoteService);
const positionsController = new PositionsController(getPositionsUC);
const maxPositions = Number(process.env.RATE_LIMIT_MAX_POSITIONS || 60);
router.get(
  '/positions',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxPositions,
    key: (req) => `rl:positions:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => positionsController.list(req, res).catch(next)
);
// Orders - Buy (protected)
const orderRepo = new PrismaOrderRepository(prisma);
const buyRepo = new PrismaBuyRepository(prisma);
const emailSvc = new SendgridEmailService();
const userReader2 = new PrismaUserReader(prisma);
const quoteService = {
  getSell: async (): Promise<{ priceBRL: number; ts: string }> => {
    const provider = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub'
      ? new StubQuoteProvider()
      : new MercadoBitcoinProvider();
    const uc = new GetCurrentQuoteUseCase(quotesCache, provider);
    const dto = await uc.execute();
    return { priceBRL: dto.sell, ts: dto.ts };
  }
};
const buyUC = new BuyBTCUseCase(quoteService, buyRepo, orderRepo, userReader2, emailSvc);
// Sell dependencies
const sellOrderRepo = new PrismaSellOrderRepository(prisma);
const sellRepo = new PrismaSellRepository(prisma);
const sellQuoteService = {
  getBuy: async (): Promise<{ priceBRL: number; ts: string }> => {
    const provider = (process.env.QUOTE_PROVIDER || 'mercadobitcoin') === 'stub'
      ? new StubQuoteProvider()
      : new MercadoBitcoinProvider();
    const uc = new GetCurrentQuoteUseCase(quotesCache, provider);
    const dto = await uc.execute();
    return { priceBRL: dto.buy, ts: dto.ts };
  }
};
const sellUC = new SellBTCUseCase(sellQuoteService, sellRepo, sellOrderRepo, userReader2, emailSvc);
const ordersController = new OrdersController(buyUC, sellUC);

const maxBuy = Number(process.env.RATE_LIMIT_MAX_BUY || 30);
router.post(
  '/orders/buy',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxBuy,
    key: (req) => `rl:buy:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => ordersController.buy(req, res).catch(next)
);

const maxSell = Number(process.env.RATE_LIMIT_MAX_SELL || 30);
router.post(
  '/orders/sell',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxSell,
    key: (req) => `rl:sell:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => ordersController.sell(req, res).catch(next)
);

// Statement (protected)
const txRepo = new PrismaTransactionRepository(prisma);
const statementUC = new GetStatementUseCase(txRepo);
const statementController = new StatementController(statementUC);
const maxStatement = Number(process.env.RATE_LIMIT_MAX_STATEMENT || 40);
router.get(
  '/statement',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxStatement,
    key: (req) => `rl:statement:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => statementController.list(req, res).catch(next)
);

// Metrics - Daily Volume (protected)
const dailyRepo = new PrismaDailyVolumeRepository(prisma);
const dailyUC = new GetDailyVolumeUseCase(dailyRepo);
const metricsController = new MetricsController(dailyUC);
const maxDailyVol = Number(process.env.RATE_LIMIT_MAX_DAILY_VOLUME || 60);
router.get(
  '/metrics/daily-volume',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxDailyVol,
    key: (req) => `rl:dailyvol:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => metricsController.dailyVolume(req, res).catch(next)
);

// Quotes history (protected)
const quoteRepo = new PrismaQuoteHistoryRepository(prisma);
const historyUC = new GetHistory24hUseCase(quoteRepo);
const historyController = new HistoryController(historyUC);
const maxHistory = Number(process.env.RATE_LIMIT_MAX_HISTORY || 60);
router.get(
  '/quotes/history',
  authGuard(),
  rateLimit({
    client: redis,
    windowSec,
    max: maxHistory,
    key: (req) => `rl:history:${(req as any).user?.id || req.ip}`,
  }),
  (req, res, next) => historyController.history(req, res).catch(next)
);

export { router };
