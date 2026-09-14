import { ThreadCategory } from "../repo/ThreadCategory";
import path from "path";
import fs from "fs";

// This function is called by src/index.ts after the DB is connected
export async function runSeeder(AppDataSource: any) {
  try {
    const categoryRepo = AppDataSource.getRepository(ThreadCategory);
    const count = await categoryRepo.count();
    
    if (count > 0) {
      console.log(" Seeder: Categories already exist. Skipping.");
      return;
    }

    console.log(" Seeder: Database empty. Seeding 中國文學 categories...");
    // Use process.cwd() instead of __dirname for ESM compatibility in Docker
    const jsonPath = path.join(process.cwd(), 'seed-data/threads/chinese-literature-categories.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(` Seeder: Cannot find ${jsonPath}`);
      return;
    }

    const categoriesData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    for (const cat of categoriesData) {
      const category = categoryRepo.create({
        name: cat.title,
        description: cat.body
      });
      await categoryRepo.save(category);
    }
    
    console.log(` Seeder: Successfully inserted ${categoriesData.length} categories.`);
  } catch (error) {
    console.error(" Seeder: Failed to seed database:", error);
  }
}
