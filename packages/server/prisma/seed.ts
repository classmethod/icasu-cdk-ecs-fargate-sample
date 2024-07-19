import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleTaskData = [
  {
    taskId: '4e5b93e1-b027-4eb7-83ab-f6be67d280cc',
    userId: '<replace>',
  },
  {
    taskId: '994eda6d-a106-477e-b827-ee03a5689ecd',
    userId: '<replace>',
  },
];

const migrate = async () => {
  await prisma.$transaction(async (tx) => {
    return await Promise.all(
      sampleTaskData.map(async (task) => {
        return tx.tasks.create({
          data: task,
        });
      })
    );
  });
};

const main = async () => {
  await migrate();
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
