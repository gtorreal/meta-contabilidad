import { prisma } from "../db.js";

export async function assertAssetEditable(assetId: string): Promise<void> {
  const locked = await prisma.assetPeriodSnapshot.findFirst({
    where: {
      assetId,
      period: { status: "CLOSED" },
    },
    include: { period: true },
  });
  if (locked) {
    throw new Error(
      `El activo tiene snapshot en período cerrado ${locked.period.year}-${String(locked.period.month).padStart(2, "0")}. Reabra el período (Admin) para permitir cambios.`,
    );
  }
}
