import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@local.dev" },
    create: { email: "admin@local.dev", role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  await prisma.usefulLifeCategory.upsert({
    where: { code: "EQ_COMP" },
    create: {
      code: "EQ_COMP",
      name: "Equipos computacionales",
      normalLifeMonths: 36,
      acceleratedLifeMonths: 18,
    },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
