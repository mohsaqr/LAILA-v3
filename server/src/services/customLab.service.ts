import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

// Types for input data
interface CreateCustomLabInput {
  name: string;
  description?: string;
  labType: string;
  config?: string;
  isPublic?: boolean;
}

interface UpdateCustomLabInput {
  name?: string;
  description?: string;
  labType?: string;
  config?: string;
  isPublic?: boolean;
}

interface CreateLabTemplateInput {
  title: string;
  description?: string;
  code: string;
  orderIndex?: number;
}

interface UpdateLabTemplateInput {
  title?: string;
  description?: string;
  code?: string;
  orderIndex?: number;
}

interface LabFilters {
  labType?: string;
  search?: string;
  creatorId?: number;
  isPublic?: boolean;
}

// Default templates for TNA lab
const TNA_DEFAULT_TEMPLATES = [
  {
    title: 'Load Data & Create Model',
    description: 'Load the TNA package and sample data, then create a transition network model',
    code: `library(tna)
data(group_regulation)
Model <- tna(group_regulation)
print(Model)`,
    orderIndex: 0,
  },
  {
    title: 'View Centralities',
    description: 'Calculate and view centrality measures for the network',
    code: `cent <- centralities(Model)
print(cent)`,
    orderIndex: 1,
  },
  {
    title: 'Plot Centralities',
    description: 'Create a visualization of the centrality measures',
    code: `p <- plot(centralities(Model))
print(p)`,
    orderIndex: 2,
  },
  {
    title: 'Plot Network',
    description: 'Create a network visualization using circle layout',
    code: `# Plot the transition network with circle layout
# (WebR compatible - does not require quadprog)
ggplot_tna(Model, layout = "circle")`,
    orderIndex: 3,
  },
  {
    title: 'Network Summary',
    description: 'View summary statistics of the transition network',
    code: `# View network summary
summary(Model)`,
    orderIndex: 4,
  },
];

// Default templates for Statistics lab
const STATISTICS_DEFAULT_TEMPLATES = [
  {
    title: 'Load Sample Data',
    description: 'Load the mtcars dataset for demonstration',
    code: `# Load sample data
data(mtcars)
head(mtcars)

# Quick overview
str(mtcars)`,
    orderIndex: 0,
  },
  {
    title: 'Descriptive Statistics',
    description: 'Calculate summary statistics for numeric variables',
    code: `# Descriptive statistics
summary(mtcars)

# Detailed descriptive stats
descriptives <- data.frame(
  Variable = names(mtcars),
  N = sapply(mtcars, length),
  Mean = sapply(mtcars, mean),
  SD = sapply(mtcars, sd),
  Min = sapply(mtcars, min),
  Max = sapply(mtcars, max)
)
print(descriptives, row.names = FALSE)`,
    orderIndex: 1,
  },
  {
    title: 'Independent t-test',
    description: 'Compare means between two groups',
    code: `# Independent samples t-test
# Compare MPG between automatic (am=0) and manual (am=1) transmission

auto <- mtcars$mpg[mtcars$am == 0]
manual <- mtcars$mpg[mtcars$am == 1]

# Run t-test
t_result <- t.test(auto, manual)
print(t_result)

# Effect size (Cohen's d)
cohens_d <- (mean(manual) - mean(auto)) / sqrt((sd(auto)^2 + sd(manual)^2) / 2)
cat("\\nCohen's d:", round(cohens_d, 3))

# Group descriptives
cat("\\n\\nGroup Statistics:")
cat("\\nAutomatic: M =", round(mean(auto), 2), ", SD =", round(sd(auto), 2), ", n =", length(auto))
cat("\\nManual: M =", round(mean(manual), 2), ", SD =", round(sd(manual), 2), ", n =", length(manual))`,
    orderIndex: 2,
  },
  {
    title: 'Paired t-test',
    description: 'Compare two related measurements',
    code: `# Paired samples t-test example
# Simulating pre-post data
set.seed(42)
pre_score <- rnorm(30, mean = 50, sd = 10)
post_score <- pre_score + rnorm(30, mean = 5, sd = 5)

# Run paired t-test
t_result <- t.test(post_score, pre_score, paired = TRUE)
print(t_result)

# Effect size
diff <- post_score - pre_score
cohens_d <- mean(diff) / sd(diff)
cat("\\nCohen's d:", round(cohens_d, 3))

# Descriptives
cat("\\n\\nDescriptives:")
cat("\\nPre: M =", round(mean(pre_score), 2), ", SD =", round(sd(pre_score), 2))
cat("\\nPost: M =", round(mean(post_score), 2), ", SD =", round(sd(post_score), 2))
cat("\\nDifference: M =", round(mean(diff), 2), ", SD =", round(sd(diff), 2))`,
    orderIndex: 3,
  },
  {
    title: 'Correlation Analysis',
    description: 'Examine relationships between variables',
    code: `# Correlation analysis
# Select numeric variables
vars <- mtcars[, c("mpg", "hp", "wt", "qsec")]

# Correlation matrix
cor_matrix <- cor(vars)
print(round(cor_matrix, 3))

# Test individual correlations with p-values
cat("\\n\\nCorrelation Tests:")
cat("\\n\\nMPG vs Weight:")
print(cor.test(mtcars$mpg, mtcars$wt))

cat("\\nMPG vs Horsepower:")
print(cor.test(mtcars$mpg, mtcars$hp))`,
    orderIndex: 4,
  },
  {
    title: 'Simple Linear Regression',
    description: 'Predict one variable from another',
    code: `# Simple linear regression
# Predicting MPG from weight

model <- lm(mpg ~ wt, data = mtcars)
summary(model)

# Confidence intervals
cat("\\n95% Confidence Intervals:")
print(confint(model))

# Model diagnostics
cat("\\nR-squared:", round(summary(model)$r.squared, 3))
cat("\\nAdjusted R-squared:", round(summary(model)$adj.r.squared, 3))`,
    orderIndex: 5,
  },
  {
    title: 'Multiple Regression',
    description: 'Predict outcome from multiple predictors',
    code: `# Multiple regression
# Predicting MPG from weight, horsepower, and transmission

model <- lm(mpg ~ wt + hp + am, data = mtcars)
summary(model)

# Standardized coefficients (beta weights)
mtcars_scaled <- as.data.frame(scale(mtcars[, c("mpg", "wt", "hp", "am")]))
model_std <- lm(mpg ~ wt + hp + am, data = mtcars_scaled)
cat("\\nStandardized Coefficients (Beta):")
print(round(coef(model_std)[-1], 3))

# Confidence intervals
cat("\\n95% Confidence Intervals:")
print(confint(model))`,
    orderIndex: 6,
  },
  {
    title: 'One-Way ANOVA',
    description: 'Compare means across multiple groups',
    code: `# One-way ANOVA
# Compare MPG across number of cylinders (4, 6, 8)

mtcars$cyl <- factor(mtcars$cyl)
anova_result <- aov(mpg ~ cyl, data = mtcars)
summary(anova_result)

# Effect size (eta-squared)
ss_between <- summary(anova_result)[[1]]["cyl", "Sum Sq"]
ss_total <- sum(summary(anova_result)[[1]][, "Sum Sq"])
eta_sq <- ss_between / ss_total
cat("\\nEta-squared:", round(eta_sq, 3))

# Post-hoc tests (Tukey HSD)
cat("\\n\\nPost-hoc Comparisons (Tukey HSD):")
print(TukeyHSD(anova_result))

# Group means
cat("\\nGroup Means:")
print(aggregate(mpg ~ cyl, data = mtcars, FUN = function(x) c(M = mean(x), SD = sd(x), N = length(x))))`,
    orderIndex: 7,
  },
  {
    title: 'Two-Way ANOVA',
    description: 'Examine main effects and interactions',
    code: `# Two-way ANOVA
# MPG by cylinders and transmission

mtcars$cyl <- factor(mtcars$cyl)
mtcars$am <- factor(mtcars$am, labels = c("Auto", "Manual"))

anova_result <- aov(mpg ~ cyl * am, data = mtcars)
summary(anova_result)

# Effect sizes (partial eta-squared)
ss <- summary(anova_result)[[1]][, "Sum Sq"]
ss_total <- sum(ss)
cat("\\nPartial Eta-squared:")
cat("\\n  Cylinders:", round(ss[1]/ss_total, 3))
cat("\\n  Transmission:", round(ss[2]/ss_total, 3))
cat("\\n  Interaction:", round(ss[3]/ss_total, 3))

# Cell means
cat("\\n\\nCell Means:")
print(aggregate(mpg ~ cyl + am, data = mtcars, FUN = mean))`,
    orderIndex: 8,
  },
  {
    title: 'Chi-Square Test',
    description: 'Test association between categorical variables',
    code: `# Chi-square test of independence
# Association between cylinders and transmission

table_data <- table(mtcars$cyl, mtcars$am)
colnames(table_data) <- c("Automatic", "Manual")
print(table_data)

# Chi-square test
chi_result <- chisq.test(table_data)
print(chi_result)

# Effect size (Cramer's V)
n <- sum(table_data)
min_dim <- min(nrow(table_data), ncol(table_data)) - 1
cramers_v <- sqrt(chi_result$statistic / (n * min_dim))
cat("\\nCramer's V:", round(cramers_v, 3))

# Proportions
cat("\\n\\nColumn Proportions:")
print(round(prop.table(table_data, margin = 2), 3))`,
    orderIndex: 9,
  },
  {
    title: 'Normality Tests',
    description: 'Check if data follows normal distribution',
    code: `# Normality tests

# Shapiro-Wilk test
cat("Shapiro-Wilk Test for MPG:")
print(shapiro.test(mtcars$mpg))

cat("\\nShapiro-Wilk Test for HP:")
print(shapiro.test(mtcars$hp))

# Descriptive stats for normality assessment
assess_normality <- function(x, name) {
  cat("\\n", name, ":")
  cat("\\n  Skewness:", round((sum((x - mean(x))^3) / length(x)) / (sd(x)^3), 3))
  cat("\\n  Kurtosis:", round((sum((x - mean(x))^4) / length(x)) / (sd(x)^4) - 3, 3))
}

assess_normality(mtcars$mpg, "MPG")
assess_normality(mtcars$hp, "Horsepower")`,
    orderIndex: 10,
  },
];

// Map lab types to their default templates
const DEFAULT_TEMPLATES_MAP: Record<string, typeof TNA_DEFAULT_TEMPLATES> = {
  tna: TNA_DEFAULT_TEMPLATES,
  statistics: STATISTICS_DEFAULT_TEMPLATES,
};

export class CustomLabService {
  /**
   * Verify that the user owns the lab
   */
  private async verifyLabOwnership(labId: number, userId: number, isAdmin = false) {
    const lab = await prisma.customLab.findUnique({
      where: { id: labId },
    });

    if (!lab) {
      throw new AppError('Lab not found', 404);
    }

    if (lab.createdBy !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return lab;
  }

  /**
   * Check if user can access a lab (public, owns it, or assigned to their course)
   */
  private async canAccessLab(labId: number, userId: number, isAdmin = false) {
    const lab = await prisma.customLab.findUnique({
      where: { id: labId },
      include: {
        assignments: {
          include: {
            course: {
              include: {
                enrollments: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!lab) {
      throw new AppError('Lab not found', 404);
    }

    // Admin can access all
    if (isAdmin) return lab;

    // Creator can access
    if (lab.createdBy === userId) return lab;

    // Public labs can be accessed
    if (lab.isPublic) return lab;

    // Check if user is enrolled in any course that has this lab assigned
    const hasAccess = lab.assignments.some(
      (assignment) => assignment.course.enrollments.length > 0
    );

    if (!hasAccess) {
      // Check if user is instructor of any assigned course
      const instructorCourses = await prisma.course.findMany({
        where: {
          instructorId: userId,
          labAssignments: {
            some: { labId },
          },
        },
      });

      if (instructorCourses.length === 0) {
        throw new AppError('Not authorized to access this lab', 403);
      }
    }

    return lab;
  }

  // ==========================================================================
  // CUSTOM LAB OPERATIONS
  // ==========================================================================

  /**
   * Get all labs accessible by a user (public + assigned to their courses + created by them)
   */
  async getLabs(userId: number, isInstructor: boolean, isAdmin: boolean, filters: LabFilters = {}) {
    const where: any = {
      OR: [
        { isPublic: true },
        { createdBy: userId },
      ],
    };

    // For non-instructors, also include labs assigned to their enrolled courses
    if (!isInstructor && !isAdmin) {
      const enrolledCourses = await prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      });
      const courseIds = enrolledCourses.map((e) => e.courseId);

      if (courseIds.length > 0) {
        where.OR.push({
          assignments: {
            some: {
              courseId: { in: courseIds },
            },
          },
        });
      }
    }

    // Apply filters
    if (filters.labType) {
      where.labType = filters.labType;
    }

    if (filters.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: filters.search } },
            { description: { contains: filters.search } },
          ],
        },
      ];
    }

    const labs = await prisma.customLab.findMany({
      where,
      include: {
        creator: {
          select: { id: true, fullname: true },
        },
        templates: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { templates: true, assignments: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return labs;
  }

  /**
   * Get labs created by a specific instructor
   */
  async getInstructorLabs(instructorId: number) {
    const labs = await prisma.customLab.findMany({
      where: { createdBy: instructorId },
      include: {
        creator: {
          select: { id: true, fullname: true },
        },
        templates: {
          orderBy: { orderIndex: 'asc' },
        },
        assignments: {
          include: {
            course: {
              select: { id: true, title: true, slug: true },
            },
            module: {
              select: { id: true, title: true },
            },
          },
        },
        _count: {
          select: { templates: true, assignments: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return labs;
  }

  /**
   * Get a lab by ID with all its templates
   */
  async getLabById(labId: number, userId: number, isAdmin = false) {
    await this.canAccessLab(labId, userId, isAdmin);

    const lab = await prisma.customLab.findUnique({
      where: { id: labId },
      include: {
        creator: {
          select: { id: true, fullname: true },
        },
        templates: {
          orderBy: { orderIndex: 'asc' },
        },
        assignments: {
          include: {
            course: {
              select: { id: true, title: true, slug: true },
            },
            module: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    return lab;
  }

  /**
   * Create a new custom lab
   */
  async createLab(creatorId: number, data: CreateCustomLabInput, addDefaultTemplates = true) {
    const lab = await prisma.customLab.create({
      data: {
        name: data.name,
        description: data.description,
        labType: data.labType,
        config: data.config,
        isPublic: data.isPublic ?? false,
        createdBy: creatorId,
      },
      include: {
        creator: {
          select: { id: true, fullname: true },
        },
        templates: true,
      },
    });

    // Add default templates if requested and available for this lab type
    const defaultTemplates = DEFAULT_TEMPLATES_MAP[data.labType];
    if (addDefaultTemplates && defaultTemplates) {
      await prisma.labTemplate.createMany({
        data: defaultTemplates.map((t) => ({
          ...t,
          labId: lab.id,
        })),
      });

      // Fetch updated lab with templates
      return prisma.customLab.findUnique({
        where: { id: lab.id },
        include: {
          creator: {
            select: { id: true, fullname: true },
          },
          templates: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    }

    return lab;
  }

  /**
   * Update a custom lab
   */
  async updateLab(labId: number, userId: number, data: UpdateCustomLabInput, isAdmin = false) {
    await this.verifyLabOwnership(labId, userId, isAdmin);

    const updated = await prisma.customLab.update({
      where: { id: labId },
      data,
      include: {
        creator: {
          select: { id: true, fullname: true },
        },
        templates: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return updated;
  }

  /**
   * Delete a custom lab
   */
  async deleteLab(labId: number, userId: number, isAdmin = false) {
    await this.verifyLabOwnership(labId, userId, isAdmin);

    await prisma.customLab.delete({
      where: { id: labId },
    });

    return { message: 'Lab deleted successfully' };
  }

  // ==========================================================================
  // LAB TEMPLATE OPERATIONS
  // ==========================================================================

  /**
   * Add a template to a lab
   */
  async addTemplate(labId: number, userId: number, data: CreateLabTemplateInput, isAdmin = false) {
    await this.verifyLabOwnership(labId, userId, isAdmin);

    // Get max order index
    const maxOrder = await prisma.labTemplate.findFirst({
      where: { labId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const template = await prisma.labTemplate.create({
      data: {
        labId,
        title: data.title,
        description: data.description,
        code: data.code,
        orderIndex: data.orderIndex ?? (maxOrder?.orderIndex ?? -1) + 1,
      },
    });

    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: number, userId: number, data: UpdateLabTemplateInput, isAdmin = false) {
    const template = await prisma.labTemplate.findUnique({
      where: { id: templateId },
      include: { lab: true },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    await this.verifyLabOwnership(template.labId, userId, isAdmin);

    const updated = await prisma.labTemplate.update({
      where: { id: templateId },
      data,
    });

    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: number, userId: number, isAdmin = false) {
    const template = await prisma.labTemplate.findUnique({
      where: { id: templateId },
      include: { lab: true },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    await this.verifyLabOwnership(template.labId, userId, isAdmin);

    await prisma.labTemplate.delete({
      where: { id: templateId },
    });

    return { message: 'Template deleted successfully' };
  }

  /**
   * Reorder templates within a lab
   */
  async reorderTemplates(labId: number, userId: number, templateIds: number[], isAdmin = false) {
    await this.verifyLabOwnership(labId, userId, isAdmin);

    await Promise.all(
      templateIds.map((id, index) =>
        prisma.labTemplate.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Templates reordered successfully' };
  }

  // ==========================================================================
  // LAB ASSIGNMENT OPERATIONS
  // ==========================================================================

  /**
   * Assign a lab to a course
   */
  async assignToCourse(labId: number, courseId: number, moduleId: number | null, userId: number, isAdmin = false) {
    // Verify lab ownership or public access
    const lab = await prisma.customLab.findUnique({
      where: { id: labId },
    });

    if (!lab) {
      throw new AppError('Lab not found', 404);
    }

    // Only creator or admin can assign private labs
    if (!lab.isPublic && lab.createdBy !== userId && !isAdmin) {
      throw new AppError('Not authorized to assign this lab', 403);
    }

    // Verify course ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== userId && !isAdmin) {
      throw new AppError('Not authorized to modify this course', 403);
    }

    // Check if already assigned
    const existing = await prisma.labAssignment.findUnique({
      where: {
        labId_courseId: { labId, courseId },
      },
    });

    if (existing) {
      throw new AppError('Lab is already assigned to this course', 400);
    }

    const assignment = await prisma.labAssignment.create({
      data: {
        labId,
        courseId,
        moduleId,
      },
      include: {
        lab: {
          select: { id: true, name: true, labType: true },
        },
        course: {
          select: { id: true, title: true },
        },
        module: {
          select: { id: true, title: true },
        },
      },
    });

    return assignment;
  }

  /**
   * Remove a lab assignment from a course
   */
  async unassignFromCourse(labId: number, courseId: number, userId: number, isAdmin = false) {
    // Verify course ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== userId && !isAdmin) {
      throw new AppError('Not authorized to modify this course', 403);
    }

    const assignment = await prisma.labAssignment.findUnique({
      where: {
        labId_courseId: { labId, courseId },
      },
    });

    if (!assignment) {
      throw new AppError('Lab assignment not found', 404);
    }

    await prisma.labAssignment.delete({
      where: { id: assignment.id },
    });

    return { message: 'Lab unassigned successfully' };
  }

  /**
   * Get labs assigned to a course
   */
  async getLabsForCourse(courseId: number) {
    const assignments = await prisma.labAssignment.findMany({
      where: { courseId },
      include: {
        lab: {
          include: {
            creator: {
              select: { id: true, fullname: true },
            },
            _count: {
              select: { templates: true },
            },
          },
        },
        module: {
          select: { id: true, title: true },
        },
      },
    });

    return assignments;
  }

  /**
   * Get available lab types
   */
  getLabTypes() {
    return [
      { id: 'tna', name: 'TNA Lab', description: 'Transition Network Analysis using the tna R package' },
      { id: 'statistics', name: 'Statistics Lab', description: 'Basic statistics and data analysis' },
      { id: 'network', name: 'Network Analysis Lab', description: 'General network and graph analysis' },
      { id: 'sequence', name: 'Sequence Analysis Lab', description: 'Sequence pattern mining and analysis' },
      { id: 'dataviz', name: 'Data Visualization Lab', description: 'Create visualizations with ggplot2' },
      { id: 'regression', name: 'Regression Lab', description: 'Linear and logistic regression analysis' },
      { id: 'clustering', name: 'Clustering Lab', description: 'Cluster analysis and segmentation' },
      { id: 'timeseries', name: 'Time Series Lab', description: 'Time series analysis and forecasting' },
      { id: 'text', name: 'Text Analysis Lab', description: 'Text mining and NLP analysis' },
      { id: 'custom', name: 'Custom Lab', description: 'Create your own custom R lab' },
    ];
  }
}

export const customLabService = new CustomLabService();
