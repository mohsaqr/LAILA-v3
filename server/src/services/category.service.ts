import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

export class CategoryService {
  async getCategories() {
    return prisma.category.findMany({
      orderBy: { title: 'asc' },
    });
  }

  async createCategory(title: string) {
    const existing = await prisma.category.findUnique({ where: { title } });
    if (existing) {
      throw new AppError('Category already exists', 400);
    }
    return prisma.category.create({ data: { title } });
  }

  async updateCategory(id: number, title: string) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError('Category not found', 404);
    }
    return prisma.category.update({ where: { id }, data: { title } });
  }

  async deleteCategory(id: number) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError('Category not found', 404);
    }
    await prisma.category.delete({ where: { id } });
    return { message: 'Category deleted successfully' };
  }
}

export const categoryService = new CategoryService();
