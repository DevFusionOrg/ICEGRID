import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD ?? "ChangeMe123!";

const users = [
  { email: "admin@ncpors.local", name: "NCPOR Administrator", role: UserRole.ADMIN },
  { email: "coordinator@ncpors.local", name: "Expedition Coordinator", role: UserRole.COORDINATOR },
  { email: "field@ncpors.local", name: "Field Personnel", role: UserRole.FIELD_PERSONNEL },
  { email: "logistics@ncpors.local", name: "Logistics Officer", role: UserRole.LOGISTICS_OFFICER },
];

for (const user of users) {
  await prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.name, role: user.role, passwordHash: await bcrypt.hash(password, 12), isActive: true },
    create: { ...user, passwordHash: await bcrypt.hash(password, 12) },
  });
}

console.log(`Seeded ${users.length} users. Development password: ${password}`);
await prisma.$disconnect();
