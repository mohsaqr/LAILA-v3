import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

// Types for input data
interface CreateCodeLabInput {
  title: string;
  description?: string;
  isPublished?: boolean;
}

interface UpdateCodeLabInput {
  title?: string;
  description?: string;
  isPublished?: boolean;
  orderIndex?: number;
}

interface CreateCodeBlockInput {
  title: string;
  instructions?: string;
  starterCode?: string;
}

interface UpdateCodeBlockInput {
  title?: string;
  instructions?: string;
  starterCode?: string;
  orderIndex?: number;
}

export class CodeLabService {
  /**
   * Verify that the user owns the module (through course ownership)
   */
  private async verifyModuleOwnership(moduleId: number, instructorId: number, isAdmin = false) {
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    if (module.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return module;
  }

  /**
   * Verify that the user owns the code lab (through module -> course ownership)
   */
  private async verifyCodeLabOwnership(codeLabId: number, instructorId: number, isAdmin = false) {
    const codeLab = await prisma.codeLab.findUnique({
      where: { id: codeLabId },
      include: {
        module: {
          include: { course: true },
        },
      },
    });

    if (!codeLab) {
      throw new AppError('Code Lab not found', 404);
    }

    if (codeLab.module.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return codeLab;
  }

  /**
   * Verify that the user owns the code block (through codeLab -> module -> course ownership)
   */
  private async verifyCodeBlockOwnership(blockId: number, instructorId: number, isAdmin = false) {
    const block = await prisma.codeBlock.findUnique({
      where: { id: blockId },
      include: {
        codeLab: {
          include: {
            module: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!block) {
      throw new AppError('Code Block not found', 404);
    }

    if (block.codeLab.module.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return block;
  }

  // ==========================================================================
  // CODE LAB OPERATIONS
  // ==========================================================================

  /**
   * Get all code labs for a module
   */
  async getCodeLabsForModule(moduleId: number) {
    const codeLabs = await prisma.codeLab.findMany({
      where: { moduleId },
      orderBy: { orderIndex: 'asc' },
      include: {
        blocks: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return codeLabs;
  }

  /**
   * Get a code lab by ID with all its blocks
   */
  async getCodeLabById(codeLabId: number, userId?: number) {
    const codeLab = await prisma.codeLab.findUnique({
      where: { id: codeLabId },
      include: {
        blocks: {
          orderBy: { orderIndex: 'asc' },
        },
        module: {
          include: {
            course: {
              select: { id: true, title: true, slug: true, instructorId: true },
            },
          },
        },
      },
    });

    if (!codeLab) {
      throw new AppError('Code Lab not found', 404);
    }

    // Check if user has access (enrolled, instructor, or admin)
    if (userId) {
      // Check if user is admin or instructor (they have access to all courses)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true, isInstructor: true },
      });

      if (user?.isAdmin || user?.isInstructor) {
        // Admins and instructors have access to all code labs
        return codeLab;
      }

      // For regular users, check enrollment
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: codeLab.module.course.id,
          },
        },
      });

      if (!enrollment) {
        throw new AppError('You must be enrolled to access this Code Lab', 403);
      }
    }

    return codeLab;
  }

  /**
   * Create a new code lab
   */
  async createCodeLab(moduleId: number, instructorId: number, data: CreateCodeLabInput, isAdmin = false) {
    await this.verifyModuleOwnership(moduleId, instructorId, isAdmin);

    // Get max order index for this module
    const maxOrder = await prisma.codeLab.findFirst({
      where: { moduleId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const codeLab = await prisma.codeLab.create({
      data: {
        moduleId,
        title: data.title,
        description: data.description,
        isPublished: data.isPublished ?? false,
        orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
      },
      include: {
        blocks: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return codeLab;
  }

  /**
   * Update a code lab
   */
  async updateCodeLab(codeLabId: number, instructorId: number, data: UpdateCodeLabInput, isAdmin = false) {
    await this.verifyCodeLabOwnership(codeLabId, instructorId, isAdmin);

    const updated = await prisma.codeLab.update({
      where: { id: codeLabId },
      data,
      include: {
        blocks: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return updated;
  }

  /**
   * Delete a code lab
   */
  async deleteCodeLab(codeLabId: number, instructorId: number, isAdmin = false) {
    await this.verifyCodeLabOwnership(codeLabId, instructorId, isAdmin);

    await prisma.codeLab.delete({
      where: { id: codeLabId },
    });

    return { message: 'Code Lab deleted successfully' };
  }

  /**
   * Reorder code labs within a module
   */
  async reorderCodeLabs(moduleId: number, instructorId: number, codeLabIds: number[], isAdmin = false) {
    await this.verifyModuleOwnership(moduleId, instructorId, isAdmin);

    await Promise.all(
      codeLabIds.map((id, index) =>
        prisma.codeLab.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Code Labs reordered successfully' };
  }

  // ==========================================================================
  // CODE BLOCK OPERATIONS
  // ==========================================================================

  /**
   * Create a new code block in a code lab
   */
  async createCodeBlock(codeLabId: number, instructorId: number, data: CreateCodeBlockInput, isAdmin = false) {
    await this.verifyCodeLabOwnership(codeLabId, instructorId, isAdmin);

    // Get max order index for this code lab
    const maxOrder = await prisma.codeBlock.findFirst({
      where: { codeLabId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const block = await prisma.codeBlock.create({
      data: {
        codeLabId,
        title: data.title,
        instructions: data.instructions,
        starterCode: data.starterCode,
        orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
      },
    });

    return block;
  }

  /**
   * Update a code block
   */
  async updateCodeBlock(blockId: number, instructorId: number, data: UpdateCodeBlockInput, isAdmin = false) {
    await this.verifyCodeBlockOwnership(blockId, instructorId, isAdmin);

    const updated = await prisma.codeBlock.update({
      where: { id: blockId },
      data,
    });

    return updated;
  }

  /**
   * Delete a code block
   */
  async deleteCodeBlock(blockId: number, instructorId: number, isAdmin = false) {
    await this.verifyCodeBlockOwnership(blockId, instructorId, isAdmin);

    await prisma.codeBlock.delete({
      where: { id: blockId },
    });

    return { message: 'Code Block deleted successfully' };
  }

  /**
   * Reorder code blocks within a code lab
   */
  async reorderCodeBlocks(codeLabId: number, instructorId: number, blockIds: number[], isAdmin = false) {
    await this.verifyCodeLabOwnership(codeLabId, instructorId, isAdmin);

    await Promise.all(
      blockIds.map((id, index) =>
        prisma.codeBlock.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Code Blocks reordered successfully' };
  }
}

export const codeLabService = new CodeLabService();
