import path from 'node:path';

const seedFile = 'initial-seed.ts';

const seedFilePath = path.join(__dirname, './seed', seedFile);

const seedDatabase = async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(seedFilePath);

    if ('seedDatabase' in mod && typeof mod.seedDatabase === 'function') {
      console.log(`[SEEDING]: ${seedFile}`);

      await mod.seedDatabase();
      console.log('Database seeded successfully');
    } else {
      console.error(`[ERROR]: ${seedFile} does not export a valid seedDatabase function`);
    }
  } catch (error) {
    console.error(`[SEEDING]: Failed to seed database with ${seedFile}`);
    console.error(error);
  } finally {
    process.exit(0);
  }
};

seedDatabase()
  .then(() => {
    console.log('Database seeded');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
