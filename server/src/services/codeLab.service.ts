import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { courseRoleService } from './courseRole.service.js';
import { assertWithinAvailability, availabilityWindowWhere } from '../utils/availability.js';
import { parseRmd, cellTitle } from '../utils/rmdParser.js';

// Types for input data
interface CreateCodeLabInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

interface UpdateCodeLabInput {
  title?: string;
  description?: string;
  isPublished?: boolean;
  orderIndex?: number;
  aiChatbotId?: number | null;
}

interface CreateCodeBlockInput {
  title: string;
  instructions?: string;
  starterCode?: string;
  locked?: boolean;
  /** Insert so the cell lands at this position in the current order. */
  position?: number;
  cellType?: 'code' | 'markdown';
}

interface UpdateCodeBlockInput {
  title?: string;
  instructions?: string;
  starterCode?: string;
  locked?: boolean;
  cellType?: 'code' | 'markdown';
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

    if (!(await courseRoleService.canEditContent(instructorId, module.course.id, isAdmin))) {
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

    if (!(await courseRoleService.canEditContent(instructorId, codeLab.module.course.id, isAdmin))) {
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

    if (!(await courseRoleService.canEditContent(instructorId, block.codeLab.module.course.id, isAdmin))) {
      throw new AppError('Not authorized', 403);
    }

    return block;
  }

  // ==========================================================================
  // CODE LAB OPERATIONS
  // ==========================================================================

  /**
   * Get all code labs for a module (with enrollment check)
   */
  async getCodeLabsForModule(moduleId: number, userId?: number, _isInstructor = false, isAdmin = false) {
    // Get the module to find the course
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { id: true, instructorId: true } } },
    });

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Staff of THIS course see drafts; the global isInstructor flag is not
    // trusted (an instructor of another course must be enrolled and sees only
    // published, in-window labs).
    const isCourseStaff = await courseRoleService.isCourseStaff(userId, module.course.id, isAdmin);
    if (userId && !isCourseStaff) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId: module.course.id },
        },
      });

      if (!enrollment) {
        throw new AppError('You must be enrolled in this course to view code labs', 403);
      }
    }

    const canViewUnpublished = isCourseStaff;

    const codeLabs = await prisma.codeLab.findMany({
      where: {
        moduleId,
        ...(canViewUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() }),
      },
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

    // Access check. A code lab carries instructions/starterCode — i.e. the
    // worked solution — so a by-id fetch must be gated. Only a platform admin
    // sees any lab; the GLOBAL isInstructor flag is NOT trusted (an instructor
    // of another course was previously handed every course's lab). Course
    // owner/team bypass enrollment + window; everyone else must be an enrolled
    // student and the lab published and in-window.
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!user?.isAdmin) {
        const courseId = codeLab.module.course.id;
        const isOwner = codeLab.module.course.instructorId === userId;
        const isTeam = isOwner ? true : await courseRoleService.isTeamMember(userId, courseId);

        if (!isOwner && !isTeam) {
          const enrollment = await prisma.enrollment.findUnique({
            where: {
              userId_courseId: {
                userId,
                courseId,
              },
            },
          });

          if (!enrollment) {
            throw new AppError('You must be enrolled to access this Code Lab', 403);
          }
          if (!codeLab.isPublished) {
            throw new AppError('Code Lab not found', 404);
          }
          // Enrolled non-staff student: enforce the instructor-scheduled window.
          assertWithinAvailability(codeLab, 'Code Lab');
        }
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
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
        availableUntil: data.availableUntil ? new Date(data.availableUntil) : null,
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
   * Import an R Markdown (.Rmd) file as a new code lab. Prose between chunks
   * becomes markdown cells; each ```{r} chunk becomes an editable R code cell.
   * Lab + cells are created together so a failure leaves nothing half-imported.
   */
  async importRmd(
    moduleId: number,
    instructorId: number,
    content: string,
    title: string | undefined,
    isAdmin = false
  ) {
    await this.verifyModuleOwnership(moduleId, instructorId, isAdmin);

    const parsed = parseRmd(content);
    const labTitle =
      (title?.trim() || parsed.title?.trim() || 'Imported R Notebook').slice(0, 255);

    if (parsed.cells.length === 0) {
      throw new AppError('No content found in the R Markdown file', 400);
    }

    const codeLabId = await prisma.$transaction(async tx => {
      // Read the max order INSIDE the transaction so a concurrent create can't
      // read the same value and collide on orderIndex.
      const maxOrder = await tx.codeLab.findFirst({
        where: { moduleId },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });

      const lab = await tx.codeLab.create({
        data: {
          moduleId,
          title: labTitle,
          isPublished: false,
          orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
        },
      });

      await tx.codeBlock.createMany({
        data: parsed.cells.map((cell, index) => ({
          codeLabId: lab.id,
          title: cellTitle(cell),
          instructions: cell.type === 'markdown' ? cell.content : null,
          starterCode: cell.type === 'code' ? cell.content : null,
          orderIndex: index,
          locked: false,
          cellType: cell.type,
        })),
      });

      return lab.id;
    });

    // Return the full lab (with ordered blocks) like the other create paths.
    return prisma.codeLab.findUnique({
      where: { id: codeLabId },
      include: { blocks: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  /**
   * Import an .Rmd/.qmd file into an EXISTING code lab, appending its cells
   * after any current ones. Same parse as importRmd; used by the notebook's
   * in-editor "Import" button.
   */
  async importRmdIntoLab(codeLabId: number, instructorId: number, content: string, isAdmin = false) {
    await this.verifyCodeLabOwnership(codeLabId, instructorId, isAdmin);

    const parsed = parseRmd(content);
    if (parsed.cells.length === 0) {
      throw new AppError('No content found in the R Markdown file', 400);
    }

    // Read the append offset and insert in one transaction so a concurrent
    // import into the same lab can't reuse the same orderIndex range.
    await prisma.$transaction(async tx => {
      const maxOrder = await tx.codeBlock.findFirst({
        where: { codeLabId },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      const base = (maxOrder?.orderIndex ?? -1) + 1;

      await tx.codeBlock.createMany({
        data: parsed.cells.map((cell, i) => ({
          codeLabId,
          title: cellTitle(cell),
          instructions: cell.type === 'markdown' ? cell.content : null,
          starterCode: cell.type === 'code' ? cell.content : null,
          orderIndex: base + i,
          locked: false,
          cellType: cell.type,
        })),
      });
    });

    return prisma.codeLab.findUnique({
      where: { id: codeLabId },
      include: { blocks: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  /**
   * Update a code lab
   */
  async updateCodeLab(codeLabId: number, instructorId: number, data: UpdateCodeLabInput, isAdmin = false) {
    await this.verifyCodeLabOwnership(codeLabId, instructorId, isAdmin);

    if (data.aiChatbotId != null) {
      const bot = await prisma.chatbot.findUnique({ where: { id: data.aiChatbotId }, select: { isActive: true } });
      if (!bot || !bot.isActive) {
        throw new AppError('AI assistant not found or inactive', 400);
      }
    }

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

    const appendIndex = (maxOrder?.orderIndex ?? -1) + 1;
    const position = data.position != null ? Math.max(0, Math.min(data.position, appendIndex)) : null;

    const block = await prisma.$transaction(async tx => {
      if (position != null) {
        await tx.codeBlock.updateMany({
          where: { codeLabId, orderIndex: { gte: position } },
          data: { orderIndex: { increment: 1 } },
        });
      }
      return tx.codeBlock.create({
        data: {
          codeLabId,
          title: data.title,
          instructions: data.instructions,
          starterCode: data.starterCode,
          orderIndex: position ?? appendIndex,
          locked: data.locked ?? false,
          cellType: data.cellType ?? 'code',
        },
      });
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

    // Must be exactly a permutation of this lab's block ids — foreign ids,
    // duplicates, or omissions could corrupt another lab's ordering.
    const existing = await prisma.codeBlock.findMany({
      where: { codeLabId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(b => b.id));
    const submitted = new Set(blockIds);
    if (
      submitted.size !== blockIds.length ||
      submitted.size !== existingIds.size ||
      blockIds.some(id => !existingIds.has(id))
    ) {
      throw new AppError('Block id list must match the lab\'s blocks exactly', 400);
    }

    await prisma.$transaction(
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
