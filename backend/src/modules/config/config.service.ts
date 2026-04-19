import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

const FEE_KEY = 'session_fee';

export async function getFee(): Promise<number> {
  const config = await prisma.appConfig.findUnique({ where: { key: FEE_KEY } });
  if (!config) throw new AppError(404, 'Session fee not configured');
  return parseFloat(config.value);
}

export async function setFee(fee: number, updatedById: string): Promise<number> {
  await prisma.appConfig.upsert({
    where: { key: FEE_KEY },
    create: { key: FEE_KEY, value: fee.toFixed(2), updatedById },
    update: { value: fee.toFixed(2), updatedById },
  });
  return fee;
}
