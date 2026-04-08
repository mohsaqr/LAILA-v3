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

// Default templates for MSLQ survey lab (Pintrich et al., 1991)
const MSLQ_DEFAULT_TEMPLATES = [
  {
    title: 'Create MSLQ Data',
    description: 'Simulate Motivated Strategies for Learning Questionnaire data (Pintrich et al., 1991). The MSLQ measures motivation and self-regulated learning across 81 items on a 7-point Likert scale.',
    code: `# Motivated Strategies for Learning Questionnaire (MSLQ)
# Reference: Pintrich, P. R., Smith, D. A., Garcia, T., & McKeachie, W. J. (1991)
set.seed(42)
n <- 80  # Number of students

# MSLQ subscales (simulated with realistic inter-correlations)
# Motivation scales
intrinsic_goal <- round(pmin(7, pmax(1, rnorm(n, 4.8, 1.2))), 0)
extrinsic_goal <- round(pmin(7, pmax(1, rnorm(n, 4.2, 1.4))), 0)
task_value <- round(pmin(7, pmax(1, rnorm(n, 5.0, 1.1))), 0)
self_efficacy <- round(pmin(7, pmax(1, rnorm(n, 4.5, 1.3))), 0)
test_anxiety <- round(pmin(7, pmax(1, rnorm(n, 3.8, 1.5))), 0)

# Learning strategy scales
rehearsal <- round(pmin(7, pmax(1, rnorm(n, 4.0, 1.3))), 0)
elaboration <- round(pmin(7, pmax(1, rnorm(n, 4.5, 1.2))), 0)
critical_thinking <- round(pmin(7, pmax(1, rnorm(n, 4.2, 1.3))), 0)
metacognition <- round(pmin(7, pmax(1, rnorm(n, 4.6, 1.1))), 0)

# Outcome
final_grade <- round(pmin(100, pmax(30,
  40 + self_efficacy * 3 + metacognition * 2.5 +
  elaboration * 1.5 - test_anxiety * 1.2 + rnorm(n, 0, 8)
)), 1)

mslq <- data.frame(
  student_id = 1:n,
  intrinsic_goal, extrinsic_goal, task_value,
  self_efficacy, test_anxiety,
  rehearsal, elaboration, critical_thinking, metacognition,
  final_grade
)

cat("MSLQ Dataset Overview\\n")
str(mslq)
cat("\\nSummary Statistics:\\n")
summary(mslq[, -1])`,
    orderIndex: 0,
  },
  {
    title: 'Reliability & Descriptives',
    description: 'Compute Cronbach alpha proxies and descriptive statistics for each MSLQ subscale',
    code: `# Descriptive statistics by subscale
library(dplyr)

motivation_vars <- c("intrinsic_goal", "extrinsic_goal", "task_value", "self_efficacy", "test_anxiety")
strategy_vars <- c("rehearsal", "elaboration", "critical_thinking", "metacognition")

cat("=== Motivation Subscales ===\\n")
for (v in motivation_vars) {
  cat(sprintf("%-18s  M = %.2f  SD = %.2f  Range = %d-%d\\n",
    v, mean(mslq[[v]]), sd(mslq[[v]]), min(mslq[[v]]), max(mslq[[v]])))
}

cat("\\n=== Learning Strategy Subscales ===\\n")
for (v in strategy_vars) {
  cat(sprintf("%-18s  M = %.2f  SD = %.2f  Range = %d-%d\\n",
    v, mean(mslq[[v]]), sd(mslq[[v]]), min(mslq[[v]]), max(mslq[[v]])))
}

cat("\\n=== Outcome ===\\n")
cat(sprintf("Final Grade        M = %.2f  SD = %.2f\\n", mean(mslq$final_grade), sd(mslq$final_grade)))

# Correlation matrix: motivation & strategies vs outcome
cat("\\n=== Correlations with Final Grade ===\\n")
all_vars <- c(motivation_vars, strategy_vars)
for (v in all_vars) {
  r <- cor(mslq[[v]], mslq$final_grade)
  p <- cor.test(mslq[[v]], mslq$final_grade)$p.value
  sig <- ifelse(p < 0.001, "***", ifelse(p < 0.01, "**", ifelse(p < 0.05, "*", "")))
  cat(sprintf("%-18s  r = %+.3f  %s\\n", v, r, sig))
}`,
    orderIndex: 1,
  },
  {
    title: 'Visualize & Predict',
    description: 'Visualize relationships and build a regression model predicting achievement from MSLQ scales',
    code: `library(ggplot2)
library(tidyr)

# Reshape for visualization
mslq_long <- mslq %>%
  select(-student_id, -final_grade) %>%
  pivot_longer(everything(), names_to = "subscale", values_to = "score")

# Boxplot of all subscales
ggplot(mslq_long, aes(x = reorder(subscale, score, FUN = median), y = score, fill = subscale)) +
  geom_boxplot(show.legend = FALSE) +
  coord_flip() +
  labs(title = "MSLQ Subscale Distributions",
       x = "Subscale", y = "Score (1-7)") +
  theme_minimal()

# Regression: predict final grade from MSLQ
cat("\\n=== Multiple Regression: MSLQ -> Final Grade ===\\n")
model <- lm(final_grade ~ self_efficacy + metacognition + elaboration +
            test_anxiety + task_value, data = mslq)
summary(model)`,
    orderIndex: 2,
  },
];

// Default templates for COLLES survey lab (Taylor & Maor, 2000)
const COLLES_DEFAULT_TEMPLATES = [
  {
    title: 'Create COLLES Data',
    description: 'Simulate Constructivist On-Line Learning Environment Survey data (Taylor & Maor, 2000). COLLES measures 6 dimensions of online learning quality on a 5-point scale.',
    code: `# Constructivist On-Line Learning Environment Survey (COLLES)
# Reference: Taylor, P. C., & Maor, D. (2000)
# 6 scales, 4 items each, 5-point Likert (1=Almost Never to 5=Almost Always)
set.seed(123)
n <- 65

likert5 <- function(n, mu, sd) round(pmin(5, pmax(1, rnorm(n, mu, sd))), 0)

colles <- data.frame(
  student_id = 1:n,
  # Relevance: How relevant is online learning to professional practices?
  relevance = likert5(n, 3.8, 0.9),
  # Reflective Thinking: Does online learning stimulate critical thinking?
  reflective_thinking = likert5(n, 3.5, 1.0),
  # Interactivity: To what extent do students engage in dialogue?
  interactivity = likert5(n, 3.2, 1.1),
  # Tutor Support: How well do tutors facilitate participation?
  tutor_support = likert5(n, 3.9, 0.8),
  # Peer Support: Do fellow students provide encouragement?
  peer_support = likert5(n, 3.3, 1.0),
  # Interpretation: Do students and tutors make sense of each other?
  interpretation = likert5(n, 3.6, 0.9),
  # Overall satisfaction
  satisfaction = likert5(n, 3.7, 0.9)
)

cat("COLLES Dataset (Taylor & Maor, 2000)\\n")
cat("Scales: Relevance, Reflective Thinking, Interactivity,")
cat(" Tutor Support, Peer Support, Interpretation\\n\\n")
str(colles)
summary(colles[, -1])`,
    orderIndex: 0,
  },
  {
    title: 'Analyze COLLES Scales',
    description: 'Compare preferred vs actual learning environment and identify strengths and weaknesses',
    code: `library(dplyr)
library(tidyr)
library(ggplot2)

scales <- c("relevance", "reflective_thinking", "interactivity",
            "tutor_support", "peer_support", "interpretation")

# Descriptives
cat("=== COLLES Scale Descriptives ===\\n")
for (s in scales) {
  m <- mean(colles[[s]]); sd_val <- sd(colles[[s]])
  pct_positive <- mean(colles[[s]] >= 4) * 100
  cat(sprintf("%-22s  M = %.2f  SD = %.2f  %%Positive = %.1f%%\\n",
    s, m, sd_val, pct_positive))
}

# Correlations with satisfaction
cat("\\n=== Correlations with Overall Satisfaction ===\\n")
for (s in scales) {
  r <- cor(colles[[s]], colles$satisfaction)
  cat(sprintf("%-22s  r = %+.3f\\n", s, r))
}

# Diverging bar chart
scale_means <- sapply(colles[, scales], mean)
midpoint <- 3  # Neutral on 5-point scale
df_plot <- data.frame(
  scale = factor(names(scale_means), levels = rev(names(scale_means))),
  mean = scale_means,
  deviation = scale_means - midpoint
)

ggplot(df_plot, aes(x = scale, y = deviation, fill = deviation > 0)) +
  geom_col(show.legend = FALSE) +
  geom_hline(yintercept = 0, linewidth = 0.5) +
  coord_flip() +
  scale_fill_manual(values = c("#e74c3c", "#27ae60")) +
  labs(title = "COLLES: Deviation from Neutral (3.0)",
       subtitle = "Green = above neutral, Red = below neutral",
       x = NULL, y = "Mean - 3.0") +
  theme_minimal()`,
    orderIndex: 1,
  },
  {
    title: 'Predict Satisfaction',
    description: 'Build a model to identify which COLLES dimensions best predict overall satisfaction',
    code: `library(ggplot2)

# Multiple regression
model <- lm(satisfaction ~ relevance + reflective_thinking + interactivity +
            tutor_support + peer_support + interpretation, data = colles)
cat("=== Predicting Satisfaction from COLLES Scales ===\\n")
summary(model)

# Standardized coefficients for comparison
colles_scaled <- as.data.frame(scale(colles[, -1]))
model_std <- lm(satisfaction ~ relevance + reflective_thinking + interactivity +
                tutor_support + peer_support + interpretation, data = colles_scaled)

coefs <- data.frame(
  predictor = names(coef(model_std))[-1],
  beta = coef(model_std)[-1]
)
coefs$predictor <- factor(coefs$predictor, levels = coefs$predictor[order(abs(coefs$beta))])

ggplot(coefs, aes(x = predictor, y = beta, fill = beta > 0)) +
  geom_col(show.legend = FALSE) +
  coord_flip() +
  scale_fill_manual(values = c("#e74c3c", "#2980b9")) +
  labs(title = "Standardized Predictors of Student Satisfaction",
       subtitle = "COLLES scales (Taylor & Maor, 2000)",
       x = NULL, y = "Standardized Beta") +
  theme_minimal()`,
    orderIndex: 2,
  },
];

// Default templates for SPQ survey lab (Biggs et al., 2001)
const SPQ_DEFAULT_TEMPLATES = [
  {
    title: 'Create R-SPQ-2F Data',
    description: 'Simulate Revised Study Process Questionnaire data (Biggs, Kember & Leung, 2001). The R-SPQ-2F measures deep and surface approaches to learning with 20 items on a 5-point scale.',
    code: `# Revised Two-Factor Study Process Questionnaire (R-SPQ-2F)
# Reference: Biggs, J., Kember, D., & Leung, D. Y. P. (2001)
# 2 main scales: Deep Approach, Surface Approach
# Each has 2 subscales: Motive + Strategy
set.seed(99)
n <- 90

likert5 <- function(n, mu, sd) round(pmin(5, pmax(1, rnorm(n, mu, sd))), 0)

# Deep approach students tend to have lower surface scores (negative correlation)
deep_motive <- likert5(n, 3.6, 0.8)
deep_strategy <- likert5(n, 3.4, 0.9)
surface_motive <- likert5(n, 2.8, 0.9)
surface_strategy <- likert5(n, 2.6, 1.0)

spq <- data.frame(
  student_id = 1:n,
  deep_motive, deep_strategy,
  surface_motive, surface_strategy,
  deep_approach = round((deep_motive + deep_strategy) / 2, 2),
  surface_approach = round((surface_motive + surface_strategy) / 2, 2),
  # Simulated GPA correlated with approaches
  gpa = round(pmin(4.0, pmax(1.0,
    2.0 + (deep_motive + deep_strategy) * 0.15 -
    (surface_motive + surface_strategy) * 0.1 + rnorm(n, 0, 0.4)
  )), 2),
  year = sample(1:4, n, replace = TRUE,
                prob = c(0.35, 0.30, 0.20, 0.15))
)

cat("R-SPQ-2F Dataset (Biggs, Kember & Leung, 2001)\\n")
cat("Scales: Deep Motive, Deep Strategy, Surface Motive, Surface Strategy\\n\\n")
str(spq)
cat("\\nSummary:\\n")
summary(spq[, c("deep_approach", "surface_approach", "gpa")])`,
    orderIndex: 0,
  },
  {
    title: 'Compare Approaches',
    description: 'Analyze deep vs surface learning approaches and compare across student years',
    code: `library(dplyr)
library(ggplot2)
library(tidyr)

# Overall approach comparison
cat("=== Deep vs Surface Approach ===\\n")
cat(sprintf("Deep Approach:    M = %.2f  SD = %.2f\\n",
  mean(spq$deep_approach), sd(spq$deep_approach)))
cat(sprintf("Surface Approach: M = %.2f  SD = %.2f\\n",
  mean(spq$surface_approach), sd(spq$surface_approach)))
cat(sprintf("Paired t-test: "))
print(t.test(spq$deep_approach, spq$surface_approach, paired = TRUE))

# By year level
cat("\\n=== Approaches by Year Level ===\\n")
by_year <- spq %>%
  group_by(year) %>%
  summarise(
    n = n(),
    deep_M = mean(deep_approach),
    deep_SD = sd(deep_approach),
    surface_M = mean(surface_approach),
    surface_SD = sd(surface_approach),
    gpa_M = mean(gpa)
  )
print(as.data.frame(by_year), row.names = FALSE)

# Visualization
spq_long <- spq %>%
  select(student_id, year, deep_approach, surface_approach) %>%
  pivot_longer(c(deep_approach, surface_approach),
               names_to = "approach", values_to = "score")

ggplot(spq_long, aes(x = factor(year), y = score, fill = approach)) +
  geom_boxplot() +
  scale_fill_manual(values = c("deep_approach" = "#2980b9", "surface_approach" = "#e74c3c"),
                    labels = c("Deep", "Surface")) +
  labs(title = "Learning Approaches by Year Level (R-SPQ-2F)",
       subtitle = "Biggs, Kember & Leung (2001)",
       x = "Year", y = "Approach Score (1-5)", fill = "Approach") +
  theme_minimal()`,
    orderIndex: 1,
  },
  {
    title: 'Approaches & Achievement',
    description: 'Examine how deep and surface approaches predict academic achievement (GPA)',
    code: `library(ggplot2)

# Correlations
cat("=== Correlations with GPA ===\\n")
cat(sprintf("Deep Approach  <-> GPA: r = %+.3f (p = %.4f)\\n",
  cor(spq$deep_approach, spq$gpa),
  cor.test(spq$deep_approach, spq$gpa)$p.value))
cat(sprintf("Surface Approach <-> GPA: r = %+.3f (p = %.4f)\\n",
  cor(spq$surface_approach, spq$gpa),
  cor.test(spq$surface_approach, spq$gpa)$p.value))
cat(sprintf("Deep <-> Surface: r = %+.3f\\n",
  cor(spq$deep_approach, spq$surface_approach)))

# Regression
cat("\\n=== Regression: Approaches -> GPA ===\\n")
model <- lm(gpa ~ deep_approach + surface_approach, data = spq)
summary(model)

# Scatterplot
ggplot(spq, aes(x = deep_approach, y = gpa, color = surface_approach)) +
  geom_point(size = 3, alpha = 0.7) +
  geom_smooth(method = "lm", se = TRUE, color = "#2c3e50") +
  scale_color_gradient(low = "#27ae60", high = "#e74c3c",
                       name = "Surface\\nApproach") +
  labs(title = "Deep Approach vs GPA (colored by Surface Approach)",
       subtitle = "R-SPQ-2F (Biggs et al., 2001)",
       x = "Deep Approach Score", y = "GPA") +
  theme_minimal()`,
    orderIndex: 2,
  },
];

// Default templates for Network (igraph) lab
const NETWORK_DEFAULT_TEMPLATES = [
  {
    title: 'Create a Graph',
    description: 'Create a simple graph from an edge list using igraph',
    code: `library(igraph)

# Create a graph from an edge list
edges <- c(
  "Alice", "Bob",
  "Alice", "Carol",
  "Bob", "Dave",
  "Carol", "Dave",
  "Carol", "Eve",
  "Dave", "Eve",
  "Eve", "Frank",
  "Frank", "Alice"
)

g <- make_graph(edges, directed = FALSE)

cat("Graph summary:\\n")
print(g)
cat("\\nNumber of vertices:", vcount(g))
cat("\\nNumber of edges:", ecount(g))
cat("\\nIs directed:", is_directed(g))`,
    orderIndex: 0,
  },
  {
    title: 'Plot the Network',
    description: 'Visualize the graph with different layouts and styles',
    code: `library(igraph)
library(ggplot2)

# Recreate graph
edges <- c("Alice","Bob","Alice","Carol","Bob","Dave",
           "Carol","Dave","Carol","Eve","Dave","Eve",
           "Eve","Frank","Frank","Alice")
g <- make_graph(edges, directed = FALSE)

# Base R plot with igraph
plot(g,
     vertex.size = 30,
     vertex.color = "steelblue",
     vertex.label.color = "white",
     vertex.label.cex = 0.9,
     edge.color = "gray60",
     edge.width = 2,
     layout = layout_with_fr(g),
     main = "Social Network (Fruchterman-Reingold Layout)")`,
    orderIndex: 1,
  },
  {
    title: 'Read Data & Build Graph',
    description: 'Create a weighted graph from a data frame of edges',
    code: `library(igraph)

# Simulate an edge list with weights (e.g., interaction counts)
set.seed(42)
n_edges <- 25
from <- sample(paste0("User", 1:10), n_edges, replace = TRUE)
to <- sample(paste0("User", 1:10), n_edges, replace = TRUE)
weight <- sample(1:10, n_edges, replace = TRUE)

# Remove self-loops
valid <- from != to
edge_df <- data.frame(from = from[valid], to = to[valid], weight = weight[valid])

cat("Edge list (first 10 rows):\\n")
print(head(edge_df, 10))

# Create weighted directed graph
g <- graph_from_data_frame(edge_df, directed = TRUE)

cat("\\nGraph summary:\\n")
print(g)
cat("\\nEdge weights:", E(g)$weight)`,
    orderIndex: 2,
  },
  {
    title: 'Centrality Measures',
    description: 'Compute degree, betweenness, closeness, and eigenvector centrality',
    code: `library(igraph)

# Create a larger network
set.seed(123)
g <- sample_gnm(20, 40, directed = FALSE)
V(g)$name <- paste0("N", 1:vcount(g))

# Compute centrality measures
cent <- data.frame(
  Node = V(g)$name,
  Degree = degree(g),
  Betweenness = round(betweenness(g), 2),
  Closeness = round(closeness(g), 4),
  Eigenvector = round(eigen_centrality(g)$vector, 4)
)

# Sort by degree
cent <- cent[order(-cent$Degree), ]

cat("=== Centrality Measures ===\\n")
print(cent, row.names = FALSE)

# Most central nodes
cat("\\nMost central by degree:", cent$Node[1])
cat("\\nMost central by betweenness:", cent$Node[which.max(cent$Betweenness)])
cat("\\nMost central by eigenvector:", cent$Node[which.max(cent$Eigenvector)])`,
    orderIndex: 3,
  },
  {
    title: 'Community Detection',
    description: 'Detect communities using multiple algorithms and compare',
    code: `library(igraph)

# Create a network with community structure
set.seed(42)
g <- sample_islands(4, 8, 0.6, 3)
V(g)$name <- paste0("N", 1:vcount(g))

# Louvain method
louv <- cluster_louvain(g)
cat("=== Louvain Communities ===\\n")
cat("Number of communities:", length(louv), "\\n")
cat("Modularity:", round(modularity(louv), 3), "\\n")
for (i in seq_along(groups(louv))) {
  cat(sprintf("  Community %d: %s\\n", i, paste(groups(louv)[[i]], collapse = ", ")))
}

# Walktrap method
wt <- cluster_walktrap(g)
cat("\\n=== Walktrap Communities ===\\n")
cat("Number of communities:", length(wt), "\\n")
cat("Modularity:", round(modularity(wt), 3), "\\n")

# Plot with communities
V(g)$community <- membership(louv)
plot(g,
     vertex.color = membership(louv),
     vertex.size = 15,
     vertex.label.cex = 0.7,
     edge.color = "gray70",
     main = "Network with Louvain Communities")`,
    orderIndex: 4,
  },
  {
    title: 'Graph-Level Measures',
    description: 'Compute density, diameter, clustering coefficient, and other global metrics',
    code: `library(igraph)

# Create network
set.seed(99)
g <- sample_gnm(25, 60, directed = FALSE)
V(g)$name <- paste0("V", 1:vcount(g))

cat("=== Graph-Level Measures ===\\n")
cat("Vertices:", vcount(g), "\\n")
cat("Edges:", ecount(g), "\\n")
cat("Density:", round(edge_density(g), 4), "\\n")
cat("Diameter:", diameter(g), "\\n")
cat("Average path length:", round(mean_distance(g), 3), "\\n")
cat("Transitivity (global):", round(transitivity(g, type = "global"), 4), "\\n")
cat("Avg clustering coeff:", round(transitivity(g, type = "average"), 4), "\\n")
cat("Assortativity (degree):", round(assortativity_degree(g), 4), "\\n")
cat("Is connected:", is_connected(g), "\\n")

# Components
comp <- components(g)
cat("\\n=== Components ===\\n")
cat("Number of components:", comp$no, "\\n")
cat("Largest component size:", max(comp$csize), "\\n")

# Degree distribution
cat("\\n=== Degree Distribution ===\\n")
deg <- degree(g)
cat("Min degree:", min(deg), "\\n")
cat("Max degree:", max(deg), "\\n")
cat("Mean degree:", round(mean(deg), 2), "\\n")
cat("SD degree:", round(sd(deg), 2), "\\n")`,
    orderIndex: 5,
  },
  {
    title: 'Visualize with ggplot2',
    description: 'Create publication-quality network plots using ggplot2',
    code: `library(igraph)
library(ggplot2)

# Create network with communities
set.seed(42)
g <- sample_islands(3, 8, 0.5, 2)
V(g)$name <- paste0("N", 1:vcount(g))
comm <- cluster_louvain(g)
V(g)$community <- as.factor(membership(comm))
V(g)$degree <- degree(g)

# Get layout coordinates
layout <- layout_with_fr(g)
coords <- as.data.frame(layout)
colnames(coords) <- c("x", "y")
coords$name <- V(g)$name
coords$community <- V(g)$community
coords$degree <- V(g)$degree

# Build edge data frame
edge_list <- as_edgelist(g)
edges_df <- data.frame(
  x = coords$x[match(edge_list[,1], coords$name)],
  y = coords$y[match(edge_list[,1], coords$name)],
  xend = coords$x[match(edge_list[,2], coords$name)],
  yend = coords$y[match(edge_list[,2], coords$name)]
)

# Plot with ggplot2
ggplot() +
  geom_segment(data = edges_df,
    aes(x = x, y = y, xend = xend, yend = yend),
    color = "gray70", alpha = 0.5) +
  geom_point(data = coords,
    aes(x = x, y = y, color = community, size = degree)) +
  geom_text(data = coords,
    aes(x = x, y = y, label = name),
    size = 2.5, vjust = -1.2) +
  scale_size_continuous(range = c(3, 10)) +
  labs(title = "Network Visualization",
       subtitle = paste("Communities:", length(unique(coords$community)),
                       "| Nodes:", nrow(coords),
                       "| Edges:", nrow(edges_df)),
       color = "Community", size = "Degree") +
  theme_void() +
  theme(plot.title = element_text(face = "bold", size = 14),
        plot.subtitle = element_text(color = "gray40"))`,
    orderIndex: 6,
  },
];

// Default templates for SNA lab (R + igraph)
const SNA_DEFAULT_TEMPLATES = [
  /* ── 0. Network Construction ── */
  {
    title: '1. Build a Network from an Edge List',
    description: 'Create an igraph network from scratch using an edge list and visualize it with different layouts.',
    code: `library(igraph)

# ── Create a directed, weighted network from an edge list ──
edges <- data.frame(
  from   = c("Alice","Alice","Bob","Bob","Charlie","Diana","Diana","Eve","Eve","Frank",
             "Grace","Grace","Hannah","Ivan","Ivan","Julia","Julia","Karl","Laura","Laura"),
  to     = c("Bob","Charlie","Charlie","Diana","Alice","Eve","Frank","Frank","Grace","Grace",
             "Hannah","Ivan","Ivan","Julia","Karl","Karl","Laura","Alice","Bob","Diana"),
  weight = c(3, 2, 5, 1, 2, 4, 3, 2, 5, 1, 3, 2, 4, 1, 3, 2, 5, 1, 3, 2)
)

# Create igraph object
g <- graph_from_data_frame(edges, directed = TRUE)
cat("Network created:\\n")
cat("  Nodes:", vcount(g), "\\n")
cat("  Edges:", ecount(g), "\\n")
cat("  Directed:", is_directed(g), "\\n\\n")

# Visualize with circle layout
plot_network(g, layout = "circle", main = "Circle Layout")

# Visualize with force-directed layout
plot_network(g, layout = "fr", main = "Force-Directed Layout (Fruchterman-Reingold)")`,
    orderIndex: 0,
  },
  {
    title: '2. Build from an Adjacency Matrix',
    description: 'Create networks from adjacency matrices and compare weighted vs. unweighted representations.',
    code: `library(igraph)

# ── Build a weighted adjacency matrix ──
nodes <- c("A","B","C","D","E","F")
mat <- matrix(0, nrow = 6, ncol = 6, dimnames = list(nodes, nodes))
mat["A","B"] <- 4; mat["A","C"] <- 2
mat["B","C"] <- 5; mat["B","D"] <- 1
mat["C","D"] <- 3; mat["C","E"] <- 2
mat["D","E"] <- 4; mat["D","F"] <- 3
mat["E","F"] <- 5; mat["F","A"] <- 1

cat("Adjacency Matrix:\\n")
print(mat)

# Create weighted directed graph
g_weighted <- graph_from_adjacency_matrix(mat, mode = "directed", weighted = TRUE)

# Create unweighted undirected graph
g_undir <- graph_from_adjacency_matrix(mat + t(mat), mode = "undirected", weighted = TRUE)

# Compare
cat("\\nDirected weighted:", vcount(g_weighted), "nodes,", ecount(g_weighted), "edges\\n")
cat("Undirected weighted:", vcount(g_undir), "nodes,", ecount(g_undir), "edges\\n")

plot_network(g_weighted, layout = "circle", main = "Directed Weighted Network")
plot_network(g_undir, layout = "fr", main = "Undirected Version")`,
    orderIndex: 1,
  },
  /* ── 1. Descriptive Statistics ── */
  {
    title: '3. Network Descriptive Statistics',
    description: 'Compute comprehensive graph-level metrics: density, diameter, transitivity, reciprocity, and more.',
    code: `library(igraph)

# ── Classroom friendship network ──
set.seed(42)
edges <- data.frame(
  from   = c("Amy","Amy","Ben","Ben","Cat","Cat","Dan","Dan","Eve","Eve",
             "Fay","Fay","Guy","Guy","Hal","Ivy","Ivy","Jay","Jay","Kim",
             "Amy","Ben","Cat","Dan","Eve"),
  to     = c("Ben","Cat","Cat","Dan","Dan","Eve","Eve","Fay","Fay","Guy",
             "Guy","Hal","Hal","Ivy","Ivy","Jay","Kim","Kim","Amy","Amy",
             "Eve","Fay","Guy","Hal","Ivy"),
  weight = c(5,3,4,2,3,5,2,4,3,2,5,1,3,4,2,3,5,2,4,3,1,2,3,1,2)
)
g <- graph_from_data_frame(edges, directed = TRUE)

cat("═══════════════════════════════════════\\n")
cat("     NETWORK DESCRIPTIVE STATISTICS    \\n")
cat("═══════════════════════════════════════\\n\\n")

cat("Basic Properties:\\n")
cat("  Nodes:            ", vcount(g), "\\n")
cat("  Edges:            ", ecount(g), "\\n")
cat("  Directed:         ", is_directed(g), "\\n")
cat("  Weighted:         ", is_weighted(g), "\\n")
cat("  Simple:           ", is_simple(g), "\\n")
cat("  Connected:        ", is_connected(g, mode = "weak"), "(weakly)\\n")
cat("  Connected:        ", is_connected(g, mode = "strong"), "(strongly)\\n\\n")

cat("Structural Metrics:\\n")
cat("  Density:          ", round(edge_density(g), 4), "\\n")
cat("  Diameter:         ", diameter(g, directed = TRUE), "\\n")
cat("  Avg Path Length:  ", round(mean_distance(g, directed = TRUE), 3), "\\n")
cat("  Transitivity:     ", round(transitivity(g, type = "global"), 4), "(global clustering)\\n")
cat("  Reciprocity:      ", round(reciprocity(g), 4), "\\n")
cat("  Avg Degree:       ", round(mean(degree(g)), 2), "\\n")
cat("  Assortativity:    ", round(assortativity_degree(g), 4), "(degree)\\n\\n")

cat("Degree Distribution:\\n")
deg <- degree(g, mode = "all")
cat("  Min degree:  ", min(deg), "\\n")
cat("  Max degree:  ", max(deg), "\\n")
cat("  Median:      ", median(deg), "\\n")
cat("  Std dev:     ", round(sd(deg), 2), "\\n")`,
    orderIndex: 2,
  },
  /* ── 2. Degree Distribution ── */
  {
    title: '4. Degree Distribution Analysis',
    description: 'Analyze and visualize in-degree, out-degree, and total degree distributions. Fit power-law models.',
    code: `library(igraph)
library(ggplot2)

# ── Generate a scale-free network ──
set.seed(123)
g_sf <- sample_pa(80, m = 2, directed = TRUE)
V(g_sf)$name <- paste0("N", seq_len(vcount(g_sf)))

# ── Also a random network for comparison ──
g_er <- sample_gnm(80, 160, directed = TRUE)
V(g_er)$name <- paste0("N", seq_len(vcount(g_er)))

# ── Compute degree distributions ──
deg_sf <- degree(g_sf, mode = "all")
deg_er <- degree(g_er, mode = "all")

df <- data.frame(
  degree = c(deg_sf, deg_er),
  type   = rep(c("Scale-Free (BA)", "Random (ER)"), each = 80)
)

# ── Plot degree distributions ──
p <- ggplot(df, aes(x = degree, fill = type)) +
  geom_histogram(binwidth = 1, position = "dodge", alpha = 0.8, color = "white") +
  scale_fill_manual(values = c("#e15759", "#5a9bd4")) +
  labs(title = "Degree Distribution: Scale-Free vs Random",
       x = "Degree", y = "Count", fill = "Network Type") +
  theme_minimal(base_size = 13) +
  theme(legend.position = "top",
        plot.title = element_text(face = "bold"))
.capture_to_base64(p)

# ── In-degree vs Out-degree for scale-free ──
in_deg  <- degree(g_sf, mode = "in")
out_deg <- degree(g_sf, mode = "out")
df2 <- data.frame(node = V(g_sf)$name, in_degree = in_deg, out_degree = out_deg)

p2 <- ggplot(df2, aes(x = in_degree, y = out_degree)) +
  geom_point(size = 3, alpha = 0.6, color = "#5ab4ac") +
  geom_smooth(method = "lm", se = FALSE, color = "#e15759", linetype = "dashed") +
  labs(title = "In-Degree vs Out-Degree (Scale-Free Network)",
       x = "In-Degree", y = "Out-Degree") +
  theme_minimal(base_size = 13) +
  theme(plot.title = element_text(face = "bold"))
.capture_to_base64(p2)

cat("Correlation between in-degree and out-degree:", round(cor(in_deg, out_deg), 3), "\\n")
cat("\\nTop 5 nodes by total degree:\\n")
top5 <- head(sort(deg_sf, decreasing = TRUE), 5)
for (nm in names(top5)) cat("  ", nm, ":", top5[nm], "\\n")`,
    orderIndex: 3,
  },
  /* ── 3. Centrality Measures ── */
  {
    title: '5. Centrality Analysis (7 Measures)',
    description: 'Compute degree, betweenness, closeness, eigenvector, PageRank, hub, and authority centrality. Compare and correlate them.',
    code: `library(igraph)

# ── Research collaboration network ──
edges <- data.frame(
  from   = c("Prof_A","Prof_A","Prof_A","Prof_B","Prof_B","Prof_C","Prof_C",
             "Dr_D","Dr_D","Dr_E","Dr_E","Dr_F","Dr_F","Dr_G","Dr_G",
             "Stu_H","Stu_H","Stu_I","Stu_J","Stu_K"),
  to     = c("Prof_B","Dr_D","Dr_E","Prof_C","Dr_F","Dr_G","Stu_H",
             "Dr_E","Stu_I","Dr_F","Stu_J","Dr_G","Stu_K","Stu_H","Stu_I",
             "Stu_I","Stu_J","Stu_K","Stu_K","Prof_A"),
  weight = c(8,5,3,7,4,6,2,5,3,4,2,6,3,4,2,3,2,1,1,2)
)
g <- graph_from_data_frame(edges, directed = TRUE)

# ── Compute all centrality measures ──
cent <- data.frame(
  Node        = V(g)$name,
  Degree      = degree(g, mode = "all", normalized = TRUE),
  InDegree    = degree(g, mode = "in", normalized = TRUE),
  OutDegree   = degree(g, mode = "out", normalized = TRUE),
  Betweenness = betweenness(g, normalized = TRUE),
  Closeness   = closeness(g, normalized = TRUE),
  Eigenvector = eigen_centrality(g)$vector,
  PageRank    = page_rank(g)$vector,
  Hub         = hub_score(g)$vector,
  Authority   = authority_score(g)$vector
)

# Replace NaN with 0
cent[is.na(cent)] <- 0

# Print table sorted by PageRank
cat("═══════════════════════════════════════════════════\\n")
cat("         CENTRALITY MEASURES TABLE                 \\n")
cat("═══════════════════════════════════════════════════\\n\\n")
print(round(cent[order(-cent$PageRank), ], 4), row.names = FALSE)

# ── Visual comparison ──
plot_centrality(g, measures = c("degree","betweenness","closeness","eigenvector"),
                main = "Centrality Comparison (4 Measures)")

# ── Correlation matrix ──
cat("\\n\\nCentrality Correlations:\\n")
cor_mat <- cor(cent[, -1])
print(round(cor_mat, 3))

# ── Network sized by betweenness ──
btw <- betweenness(g, normalized = TRUE)
plot_network(g, layout = "fr",
             vertex.size = 8 + btw * 40,
             main = "Network (Node Size = Betweenness)")`,
    orderIndex: 4,
  },
  /* ── 4. Community Detection ── */
  {
    title: '6. Community Detection (5 Algorithms)',
    description: 'Compare Louvain, Walktrap, Label Propagation, Edge Betweenness, and Fast Greedy algorithms.',
    code: `library(igraph)

# ── Build a network with clear community structure ──
set.seed(42)
# 3 clusters of 10 nodes each, dense within, sparse between
g1 <- sample_gnp(10, 0.6)
g2 <- sample_gnp(10, 0.6)
g3 <- sample_gnp(10, 0.6)
g <- g1 %du% g2 %du% g3  # disjoint union

# Add some inter-community edges
n <- vcount(g)
bridge_edges <- c(5,11, 10,21, 15,25, 3,18, 8,28)
g <- add_edges(g, bridge_edges)
V(g)$name <- paste0("N", seq_len(n))

cat("Network: ", vcount(g), "nodes,", ecount(g), "edges\\n\\n")

# ── Run 5 community detection algorithms ──
algorithms <- c("louvain", "walktrap", "label_prop",
                "edge_betweenness", "fast_greedy")

for (algo in algorithms) {
  cat("──────────────────────────────\\n")
  plot_communities(g, algorithm = algo, layout = "fr")
  cat("\\n")
}

# ── Compare modularity scores ──
cat("\\n═══════════════════════════════════════\\n")
cat("   MODULARITY COMPARISON                \\n")
cat("═══════════════════════════════════════\\n\\n")

results <- data.frame(Algorithm = character(), Communities = integer(),
                      Modularity = numeric(), stringsAsFactors = FALSE)
for (algo in algorithms) {
  comm <- switch(algo,
    louvain          = cluster_louvain(as.undirected(g)),
    walktrap         = cluster_walktrap(g),
    label_prop       = cluster_label_prop(g),
    edge_betweenness = cluster_edge_betweenness(g),
    fast_greedy      = cluster_fast_greedy(as.undirected(g))
  )
  results <- rbind(results, data.frame(
    Algorithm   = algo,
    Communities = length(unique(membership(comm))),
    Modularity  = round(modularity(comm), 4)
  ))
}
print(results, row.names = FALSE)`,
    orderIndex: 5,
  },
  /* ── 5. Network Substructures ── */
  {
    title: '7. Cliques, K-Cores & Bridges',
    description: 'Find cliques, k-core decomposition, bridges, and cut vertices — the structural skeleton of the network.',
    code: `library(igraph)

# ── A network with interesting substructure ──
edges <- data.frame(
  from = c("A","A","A","B","B","C","D","D","D","E","E","F","F","G","G","H","H","I","J","J","K"),
  to   = c("B","C","D","C","D","D","E","F","G","F","G","G","H","H","I","I","J","J","K","A","A")
)
g <- graph_from_data_frame(edges, directed = FALSE)
g <- simplify(g)

cat("═══════════════════════════════════════\\n")
cat("   NETWORK SUBSTRUCTURE ANALYSIS       \\n")
cat("═══════════════════════════════════════\\n\\n")

# ── Cliques ──
cat("CLIQUES:\\n")
cliques_list <- cliques(g, min = 3)
cat("  Cliques of size >= 3:", length(cliques_list), "\\n")
max_cl <- largest_cliques(g)
cat("  Largest clique size:", clique_number(g), "\\n")
cat("  Largest clique(s):\\n")
for (cl in max_cl) {
  cat("    {", paste(V(g)$name[cl], collapse = ", "), "}\\n")
}

# ── K-Core Decomposition ──
cat("\\nK-CORE DECOMPOSITION:\\n")
coreness <- coreness(g)
for (k in sort(unique(coreness))) {
  members <- V(g)$name[coreness == k]
  cat("  ", k, "-core:", paste(members, collapse = ", "), "\\n")
}

# ── Visualize k-cores ──
vcol <- c("#c6dbef","#6baed6","#2171b5","#08306b")[
  pmin(coreness, 4)
]
plot_network(g, layout = "fr", vertex.color = vcol,
             vertex.size = 10 + coreness * 5,
             main = "K-Core Decomposition (size & color = coreness)")

# ── Bridges & Articulation points ──
cat("\\nBRIDGES (cut edges):\\n")
bridges_idx <- bridges(g)
if (length(bridges_idx) > 0) {
  el <- as_edgelist(g)
  for (b in bridges_idx) {
    cat("  ", el[b, 1], " -- ", el[b, 2], "\\n")
  }
} else { cat("  None\\n") }

cat("\\nARTICULATION POINTS (cut vertices):\\n")
ap <- articulation_points(g)
if (length(ap) > 0) {
  cat("  ", paste(V(g)$name[ap], collapse = ", "), "\\n")
  cat("  Removing these would disconnect the network.\\n")
} else { cat("  None\\n") }`,
    orderIndex: 6,
  },
  /* ── 6. Dyad & Triad Census ── */
  {
    title: '8. Dyad Census & Triad Census',
    description: 'Classify all dyads (mutual, asymmetric, null) and triads (16 MAN types) — fundamental to directed network structure.',
    code: `library(igraph)

# ── Directed discussion network ──
edges <- data.frame(
  from   = c("A","A","B","B","C","C","D","D","E","E","F","F","G","G","H","A","B","C"),
  to     = c("B","C","A","D","D","E","E","F","F","G","G","H","H","A","A","D","E","F"),
  weight = c(3,2,4,1,3,2,5,1,3,4,2,3,1,2,5,1,2,3)
)
g <- graph_from_data_frame(edges, directed = TRUE)

cat("═══════════════════════════════════════\\n")
cat("   DYAD & TRIAD CENSUS                \\n")
cat("═══════════════════════════════════════\\n\\n")

# ── Dyad Census ──
dc <- dyad_census(g)
cat("DYAD CENSUS:\\n")
cat("  Mutual (reciprocal):  ", dc$mut, "\\n")
cat("  Asymmetric (one-way): ", dc$asym, "\\n")
cat("  Null (no edge):       ", dc$null, "\\n")
total_dyads <- dc$mut + dc$asym + dc$null
cat("  Total possible dyads: ", total_dyads, "\\n")
cat("  Reciprocity rate:     ", round(dc$mut / (dc$mut + dc$asym), 3), "\\n\\n")

# ── Triad Census ──
tc <- triad_census(g)
triad_names <- c("003","012","102","021D","021U","021C","111D","111U",
                 "030T","030C","201","120D","120U","120C","210","300")
cat("TRIAD CENSUS (MAN classification):\\n")
tc_df <- data.frame(Type = triad_names, Count = tc)
tc_df <- tc_df[tc_df$Count > 0, ]
print(tc_df, row.names = FALSE)

cat("\\nInterpretation:\\n")
cat("  003 = empty triad, 300 = complete triad\\n")
cat("  High 030T (transitive) → hierarchical structure\\n")
cat("  High 102 (mutual pair + isolate) → cliquish\\n")
cat("  High 300 (complete) → very dense clusters\\n")

# Show the network
plot_network(g, layout = "fr", main = "Directed Discussion Network")`,
    orderIndex: 7,
  },
  /* ── 7. Ego Networks ── */
  {
    title: '9. Ego Network Analysis',
    description: 'Extract and compare ego networks — the local neighborhood around each node. Compute ego-level density, size, and brokerage.',
    code: `library(igraph)

# ── Social network ──
set.seed(7)
g <- sample_pa(25, m = 2, directed = FALSE)
V(g)$name <- paste0("Person_", LETTERS[seq_len(vcount(g))])

cat("═══════════════════════════════════════\\n")
cat("   EGO NETWORK ANALYSIS               \\n")
cat("═══════════════════════════════════════\\n\\n")

# ── Compute ego-level metrics for all nodes ──
ego_metrics <- data.frame(
  Node       = V(g)$name,
  Degree     = degree(g),
  EgoSize    = sapply(ego_size(g, order = 1), identity),
  EgoDensity = sapply(seq_len(vcount(g)), function(i) {
    ego_g <- make_ego_graph(g, order = 1, nodes = i)[[1]]
    if (vcount(ego_g) <= 2) return(NA)
    edge_density(ego_g)
  }),
  Constraint = round(constraint(g), 3),
  stringsAsFactors = FALSE
)
ego_metrics <- ego_metrics[order(-ego_metrics$Degree), ]

cat("Ego Network Metrics (top 10 by degree):\\n")
print(head(ego_metrics, 10), row.names = FALSE)

# ── Extract and plot the ego network of the most connected node ──
hub_node <- which.max(degree(g))
ego_g <- make_ego_graph(g, order = 1, nodes = hub_node)[[1]]
cat("\\nEgo network of", V(g)$name[hub_node], ":\\n")
cat("  Neighbors:", vcount(ego_g) - 1, "\\n")
cat("  Internal edges:", ecount(ego_g), "\\n")
cat("  Ego density:", round(edge_density(ego_g), 3), "\\n")
cat("  Burt constraint:", round(constraint(g, nodes = hub_node), 3), "\\n")
cat("  (Low constraint = structural hole advantage)\\n")

# Color the ego
vcol <- rep("#9ca3af", vcount(ego_g))
vcol[which(V(ego_g)$name == V(g)$name[hub_node])] <- "#e15759"
plot_network(ego_g, layout = "fr", vertex.color = vcol,
             vertex.size = 18,
             main = paste("Ego Network of", V(g)$name[hub_node]))

# Full network with hub highlighted
vcol_full <- rep("#5a9bd4", vcount(g))
vcol_full[hub_node] <- "#e15759"
vsize <- rep(12, vcount(g))
vsize[hub_node] <- 25
plot_network(g, layout = "fr", vertex.color = vcol_full,
             vertex.size = vsize,
             main = paste("Full Network (hub =", V(g)$name[hub_node], ")"))`,
    orderIndex: 8,
  },
  /* ── 8. Network Models & Simulation ── */
  {
    title: '10. Random Network Models',
    description: 'Generate and compare Erdos-Renyi, Barabasi-Albert, and Watts-Strogatz models. Understand their properties.',
    code: `library(igraph)
library(ggplot2)

set.seed(42)
n <- 60

# ── Generate three classic models ──
g_er <- sample_gnp(n, p = 0.08)                    # Erdos-Renyi
g_ba <- sample_pa(n, m = 2, directed = FALSE)       # Barabasi-Albert
g_ws <- sample_smallworld(1, n, nei = 3, p = 0.1)   # Watts-Strogatz

V(g_er)$name <- paste0("ER_", seq_len(n))
V(g_ba)$name <- paste0("BA_", seq_len(n))
V(g_ws)$name <- paste0("WS_", seq_len(n))

# ── Compare properties ──
cat("═══════════════════════════════════════════════\\n")
cat("   RANDOM NETWORK MODEL COMPARISON            \\n")
cat("═══════════════════════════════════════════════\\n\\n")

models <- list("Erdos-Renyi" = g_er, "Barabasi-Albert" = g_ba, "Watts-Strogatz" = g_ws)

comp <- data.frame(
  Model         = names(models),
  Nodes         = sapply(models, vcount),
  Edges         = sapply(models, ecount),
  Density       = sapply(models, function(x) round(edge_density(x), 4)),
  AvgDegree     = sapply(models, function(x) round(mean(degree(x)), 2)),
  MaxDegree     = sapply(models, function(x) max(degree(x))),
  Diameter      = sapply(models, function(x) {
    if (is_connected(x)) diameter(x) else NA
  }),
  AvgPathLength = sapply(models, function(x) round(mean_distance(x), 2)),
  Transitivity  = sapply(models, function(x) round(transitivity(x, type = "global"), 4)),
  stringsAsFactors = FALSE
)
print(comp, row.names = FALSE)

# ── Visualize each model ──
plot_network(g_er, layout = "fr", main = "Erdos-Renyi (random)")
plot_network(g_ba, layout = "fr", main = "Barabasi-Albert (preferential attachment)")
plot_network(g_ws, layout = "circle", main = "Watts-Strogatz (small world)")

# ── Degree distributions comparison ──
df <- data.frame(
  degree = c(degree(g_er), degree(g_ba), degree(g_ws)),
  model  = rep(c("Erdos-Renyi","Barabasi-Albert","Watts-Strogatz"), each = n)
)

p <- ggplot(df, aes(x = degree, fill = model)) +
  geom_histogram(binwidth = 1, alpha = 0.7, position = "identity", color = "white") +
  facet_wrap(~model, scales = "free_y") +
  scale_fill_manual(values = c("#5ab4ac","#e6ab02","#a985ca")) +
  labs(title = "Degree Distributions by Model Type",
       x = "Degree", y = "Count") +
  theme_minimal(base_size = 12) +
  theme(legend.position = "none",
        plot.title = element_text(face = "bold"))
.capture_to_base64(p)

cat("\\nKey Insights:\\n")
cat("  ER:  Bell-shaped degree distribution, low clustering\\n")
cat("  BA:  Power-law degree distribution (few hubs, many peripherals)\\n")
cat("  WS:  Uniform-ish degree, HIGH clustering, short paths\\n")`,
    orderIndex: 9,
  },
  /* ── 9. Adjacency Matrix Heatmap ── */
  {
    title: '11. Adjacency Matrix Visualization',
    description: 'Visualize the adjacency matrix as a heatmap. Reorder by community to reveal block structure.',
    code: `library(igraph)

# ── Create a network with block structure ──
set.seed(42)
g1 <- sample_gnp(8, 0.7)
g2 <- sample_gnp(8, 0.7)
g3 <- sample_gnp(8, 0.7)
g <- g1 %du% g2 %du% g3
# Add sparse inter-community edges
g <- add_edges(g, c(3,9, 7,17, 14,22, 5,20))
V(g)$name <- c(paste0("A", 1:8), paste0("B", 1:8), paste0("C", 1:8))

# ── Original order ──
plot_adjacency(g, main = "Adjacency Matrix (Original Order)")

# ── Reorder by community ──
comm <- cluster_louvain(g)
mem <- membership(comm)
node_order <- order(mem)

mat <- as.matrix(as_adjacency_matrix(g, sparse = FALSE))
mat_reordered <- mat[node_order, node_order]
g_reordered <- graph_from_adjacency_matrix(mat_reordered, mode = "undirected")
V(g_reordered)$name <- V(g)$name[node_order]

plot_adjacency(g_reordered, main = "Adjacency Matrix (Reordered by Community)")

cat("Community assignment:\\n")
for (i in sort(unique(mem))) {
  cat("  Group", i, ":", paste(V(g)$name[mem == i], collapse = ", "), "\\n")
}
cat("\\nNotice the block-diagonal structure after reordering!\\n")`,
    orderIndex: 10,
  },
  /* ── 10. Network Resilience ── */
  {
    title: '12. Network Resilience & Attack Simulation',
    description: 'Simulate targeted attacks (remove high-centrality nodes) vs random failures. Measure how quickly the network fragments.',
    code: `library(igraph)
library(ggplot2)

set.seed(42)
# Scale-free network (vulnerable to targeted attack)
g <- sample_pa(50, m = 2, directed = FALSE)
V(g)$name <- paste0("N", seq_len(vcount(g)))

cat("═══════════════════════════════════════\\n")
cat("   NETWORK RESILIENCE ANALYSIS        \\n")
cat("═══════════════════════════════════════\\n\\n")
cat("Original network:", vcount(g), "nodes,", ecount(g), "edges\\n")
cat("Original diameter:", diameter(g), "\\n")
cat("Original giant component:", max(components(g)$csize), "nodes\\n\\n")

# ── Targeted attack: remove nodes by degree ──
g_attack <- g
attack_sizes <- c(max(components(g_attack)$csize))
n_remove <- 20

for (i in seq_len(n_remove)) {
  if (vcount(g_attack) == 0) break
  hub <- which.max(degree(g_attack))
  g_attack <- delete_vertices(g_attack, hub)
  attack_sizes <- c(attack_sizes, max(components(g_attack)$csize))
}

# ── Random failure: remove random nodes ──
g_random <- g
random_sizes <- c(max(components(g_random)$csize))

for (i in seq_len(n_remove)) {
  if (vcount(g_random) == 0) break
  target <- sample(seq_len(vcount(g_random)), 1)
  g_random <- delete_vertices(g_random, target)
  random_sizes <- c(random_sizes, max(components(g_random)$csize))
}

# ── Plot comparison ──
df <- data.frame(
  removed  = rep(0:n_remove, 2),
  giant    = c(attack_sizes, random_sizes),
  strategy = rep(c("Targeted (hubs first)", "Random failure"), each = n_remove + 1)
)

p <- ggplot(df, aes(x = removed, y = giant, color = strategy)) +
  geom_line(size = 1.2) +
  geom_point(size = 2) +
  scale_color_manual(values = c("#e15759", "#5a9bd4")) +
  labs(title = "Network Resilience: Targeted Attack vs Random Failure",
       subtitle = "Scale-free networks are robust to random failure but fragile to targeted attacks",
       x = "Nodes Removed", y = "Giant Component Size", color = "") +
  theme_minimal(base_size = 13) +
  theme(legend.position = "top",
        plot.title = element_text(face = "bold"))
.capture_to_base64(p)

cat("After removing", n_remove, "nodes:\\n")
cat("  Targeted attack: giant component =", tail(attack_sizes, 1), "\\n")
cat("  Random failure:  giant component =", tail(random_sizes, 1), "\\n")`,
    orderIndex: 11,
  },
  /* ── 11. Full Analysis Pipeline ── */
  {
    title: '13. Complete SNA Pipeline (Classroom Data)',
    description: 'A full analysis pipeline on classroom data: construction, visualization, centrality, communities, and interpretation.',
    code: `library(igraph)
library(ggplot2)

# ══════════════════════════════════════════════
#  COMPLETE SNA PIPELINE — Classroom Network
# ══════════════════════════════════════════════

# ── Step 1: Construct the network ──
edges <- data.frame(
  from   = c("Emma","Emma","Emma","Liam","Liam","Liam","Olivia","Olivia",
             "Noah","Noah","Ava","Ava","Sophia","Sophia","Mason","Mason",
             "Isabella","Isabella","James","James","Mia","Mia","Ethan",
             "Charlotte","Charlotte","Amelia","Amelia","Harper"),
  to     = c("Liam","Olivia","Sophia","Noah","Emma","Ava","Sophia","Mia",
             "Mason","Ava","Isabella","James","Mia","Charlotte","Isabella","Ethan",
             "James","Amelia","Ethan","Harper","Charlotte","Amelia","Harper",
             "Amelia","Harper","Harper","Emma","Emma"),
  weight = c(5,3,4,4,5,2,6,3,3,2,4,2,5,3,4,2,3,5,2,4,4,3,2,5,2,3,4,3)
)
g <- graph_from_data_frame(edges, directed = TRUE)
cat("Step 1: Network created —", vcount(g), "students,", ecount(g), "connections\\n\\n")

# ── Step 2: Visualize ──
plot_network(g, layout = "fr", main = "Classroom Friendship Network")

# ── Step 3: Descriptive statistics ──
cat("Step 3: Descriptive Statistics\\n")
cat("  Density:         ", round(edge_density(g), 3), "\\n")
cat("  Reciprocity:     ", round(reciprocity(g), 3), "\\n")
cat("  Transitivity:    ", round(transitivity(g, type = "global"), 3), "\\n")
cat("  Avg path length: ", round(mean_distance(g), 2), "\\n")
cat("  Diameter:        ", diameter(g), "\\n\\n")

# ── Step 4: Centrality ──
cat("Step 4: Who are the key students?\\n\\n")
cent <- data.frame(
  Student     = V(g)$name,
  Degree      = degree(g, mode = "all"),
  InDegree    = degree(g, mode = "in"),
  OutDegree   = degree(g, mode = "out"),
  Betweenness = round(betweenness(g, normalized = TRUE), 3),
  PageRank    = round(page_rank(g)$vector, 3)
)
cent <- cent[order(-cent$PageRank), ]
print(cent, row.names = FALSE)

plot_centrality(g, measures = c("degree","betweenness","pagerank"),
                main = "Student Centrality Comparison")

# ── Step 5: Communities ──
cat("\\nStep 5: Social groups\\n\\n")
plot_communities(g, algorithm = "louvain", layout = "fr",
                 main = "Friendship Communities (Louvain)")

# ── Step 6: Adjacency matrix ──
plot_adjacency(g, main = "Friendship Adjacency Matrix")

# ── Step 7: Interpretation ──
top_pr <- cent$Student[1]
top_btw <- cent$Student[which.max(cent$Betweenness)]
cat("\\n═══════════════════════════════════════\\n")
cat("   INTERPRETATION                       \\n")
cat("═══════════════════════════════════════\\n\\n")
cat("Most influential (PageRank):", top_pr, "\\n")
cat("Key bridge (Betweenness):   ", top_btw, "\\n")
cat("Reciprocity", round(reciprocity(g), 2),
    "→", ifelse(reciprocity(g) > 0.5, "strong mutual friendships",
                "many one-directional nominations"), "\\n")
cat("Transitivity", round(transitivity(g, type = "global"), 2),
    "→", ifelse(transitivity(g, type = "global") > 0.3,
                "friends of friends tend to be friends (tight clusters)",
                "relatively open network structure"), "\\n")`,
    orderIndex: 12,
  },
  /* ── 12. Path Analysis ── */
  {
    title: '14. Shortest Paths & Distances',
    description: 'Compute shortest paths, distance matrices, and eccentricity. Identify the center and periphery of the network.',
    code: `library(igraph)
library(ggplot2)

# ── Create a connected network ──
set.seed(99)
g <- sample_gnp(20, 0.15)
while (!is_connected(g)) g <- sample_gnp(20, 0.15)
V(g)$name <- paste0("N", LETTERS[seq_len(vcount(g))])

cat("═══════════════════════════════════════\\n")
cat("   PATHS & DISTANCES                  \\n")
cat("═══════════════════════════════════════\\n\\n")

# ── Distance matrix ──
dist_mat <- distances(g)
cat("Distance Matrix (first 8 nodes):\\n")
print(dist_mat[1:min(8, nrow(dist_mat)), 1:min(8, ncol(dist_mat))])

# ── Eccentricity: max distance from each node ──
ecc <- eccentricity(g)
cat("\\nEccentricity (max distance from node):\\n")
ecc_df <- data.frame(Node = V(g)$name, Eccentricity = ecc)
ecc_df <- ecc_df[order(ecc_df$Eccentricity), ]
print(ecc_df, row.names = FALSE)

cat("\\nRadius (min eccentricity):", radius(g), "\\n")
cat("Diameter (max eccentricity):", diameter(g), "\\n")
cat("Center nodes:", paste(V(g)$name[ecc == radius(g)], collapse = ", "), "\\n")
cat("Peripheral nodes:", paste(V(g)$name[ecc == diameter(g)], collapse = ", "), "\\n")

# ── Shortest path example ──
src <- V(g)$name[which.min(ecc)]
dst <- V(g)$name[which.max(ecc)]
sp <- shortest_paths(g, from = src, to = dst)$vpath[[1]]
cat("\\nShortest path from", src, "to", dst, ":\\n")
cat("  ", paste(V(g)$name[sp], collapse = " → "), "\\n")
cat("  Length:", length(sp) - 1, "\\n")

# ── Visualize: color by eccentricity ──
ecc_norm <- (ecc - min(ecc)) / max(1, max(ecc) - min(ecc))
vcol <- rgb(ecc_norm, 0.3, 1 - ecc_norm)
plot_network(g, layout = "fr", vertex.color = vcol,
             vertex.size = 12 + (1 - ecc_norm) * 15,
             main = "Network Colored by Eccentricity (blue = center, red = periphery)")

# ── Distance distribution ──
d <- as.vector(dist_mat[upper.tri(dist_mat)])
df <- data.frame(distance = d)
p <- ggplot(df, aes(x = distance)) +
  geom_histogram(binwidth = 1, fill = "#5ab4ac", color = "white", alpha = 0.8) +
  labs(title = "Pairwise Distance Distribution",
       x = "Geodesic Distance", y = "Count") +
  theme_minimal(base_size = 13) +
  theme(plot.title = element_text(face = "bold"))
.capture_to_base64(p)`,
    orderIndex: 13,
  },
  /* ── 13. Bipartite Networks ── */
  {
    title: '15. Bipartite (Two-Mode) Networks',
    description: 'Create and analyze bipartite networks — students × courses. Project to one-mode and analyze.',
    code: `library(igraph)

# ── Students enrolled in courses (bipartite) ──
students <- c("Alice","Bob","Charlie","Diana","Eve","Frank","Grace","Hannah")
courses  <- c("Math","Physics","CS","Art","Biology")

enrollments <- data.frame(
  student = c("Alice","Alice","Alice","Bob","Bob","Charlie","Charlie","Charlie",
              "Diana","Diana","Eve","Eve","Eve","Frank","Frank","Grace","Grace","Hannah"),
  course  = c("Math","Physics","CS","Math","CS","Physics","CS","Art",
              "Math","Biology","CS","Art","Biology","Math","Physics","Art","Biology","Biology")
)

# Create bipartite graph
g_bi <- graph_from_data_frame(enrollments, directed = FALSE)
V(g_bi)$type <- V(g_bi)$name %in% courses

cat("═══════════════════════════════════════\\n")
cat("   BIPARTITE NETWORK ANALYSIS         \\n")
cat("═══════════════════════════════════════\\n\\n")

cat("Bipartite network:", vcount(g_bi), "nodes (", sum(!V(g_bi)$type), "students +",
    sum(V(g_bi)$type), "courses ),", ecount(g_bi), "enrollments\\n\\n")

# ── Visualize bipartite ──
vcol <- ifelse(V(g_bi)$type, "#e6ab02", "#5a9bd4")
vshape <- ifelse(V(g_bi)$type, "square", "circle")
plot_network(g_bi, layout = "fr", vertex.color = vcol,
             vertex.size = 18,
             main = "Bipartite: Students (blue) × Courses (gold)")

# ── Project to one-mode ──
projs <- bipartite_projection(g_bi)
g_students <- projs$proj1  # student × student
g_courses  <- projs$proj2  # course × course

cat("Student co-enrollment network:\\n")
cat("  ", vcount(g_students), "students,", ecount(g_students), "connections\\n")
cat("  (Two students connected if they share a course)\\n\\n")

cat("Course co-enrollment network:\\n")
cat("  ", vcount(g_courses), "courses,", ecount(g_courses), "connections\\n")
cat("  (Two courses connected if they share a student)\\n\\n")

# ── Visualize projections ──
plot_network(g_students, layout = "fr",
             main = "Student Co-Enrollment Network")

plot_network(g_courses, layout = "circle",
             main = "Course Co-Enrollment Network")

# ── Analyze student projection ──
cat("Student centrality (by shared courses):\\n")
deg <- degree(g_students)
deg_df <- data.frame(Student = V(g_students)$name, SharedCourses = deg)
print(deg_df[order(-deg_df$SharedCourses), ], row.names = FALSE)`,
    orderIndex: 14,
  },
  /* ── 14. ggplot2 Visualization ── */
  {
    title: '16. Publication-Quality Plots with ggplot2',
    description: 'Create polished ggplot2 visualizations of network metrics — centrality distributions, correlation scatter plots, and more.',
    code: `library(igraph)
library(ggplot2)

# ── Generate a rich network ──
set.seed(42)
g <- sample_pa(40, m = 2, directed = TRUE)
V(g)$name <- paste0("N", seq_len(vcount(g)))
E(g)$weight <- sample(1:5, ecount(g), replace = TRUE)

# ── Compute metrics ──
df <- data.frame(
  node        = V(g)$name,
  degree      = degree(g, mode = "all"),
  in_degree   = degree(g, mode = "in"),
  out_degree  = degree(g, mode = "out"),
  betweenness = betweenness(g, normalized = TRUE),
  closeness   = closeness(g, normalized = TRUE),
  pagerank    = page_rank(g)$vector,
  constraint  = constraint(g)
)
df$constraint[!is.finite(df$constraint)] <- NA

# ── 1. Centrality Distribution ──
p1 <- ggplot(df, aes(x = reorder(node, -pagerank), y = pagerank)) +
  geom_col(aes(fill = pagerank), show.legend = FALSE) +
  scale_fill_gradient(low = "#c6dbef", high = "#08306b") +
  labs(title = "PageRank Distribution",
       x = NULL, y = "PageRank") +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size = 7),
        plot.title = element_text(face = "bold", size = 14))
.capture_to_base64(p1)

# ── 2. Betweenness vs Degree ──
p2 <- ggplot(df, aes(x = degree, y = betweenness)) +
  geom_point(aes(size = pagerank, color = closeness), alpha = 0.7) +
  geom_text(data = df[df$betweenness > quantile(df$betweenness, 0.9), ],
            aes(label = node), vjust = -1, size = 3) +
  scale_color_gradient(low = "#fee0d2", high = "#de2d26") +
  scale_size_continuous(range = c(2, 10)) +
  labs(title = "Betweenness vs Degree",
       subtitle = "Size = PageRank, Color = Closeness",
       x = "Degree", y = "Betweenness (normalized)") +
  theme_minimal(base_size = 12) +
  theme(plot.title = element_text(face = "bold"))
.capture_to_base64(p2)

# ── 3. In-degree vs Out-degree ──
p3 <- ggplot(df, aes(x = in_degree, y = out_degree)) +
  geom_jitter(size = 3, alpha = 0.6, color = "#5ab4ac", width = 0.2, height = 0.2) +
  geom_abline(slope = 1, intercept = 0, linetype = "dashed", color = "gray50") +
  labs(title = "In-Degree vs Out-Degree",
       subtitle = "Points above the diagonal: more outgoing than incoming",
       x = "In-Degree", y = "Out-Degree") +
  theme_minimal(base_size = 12) +
  theme(plot.title = element_text(face = "bold"))
.capture_to_base64(p3)

# ── 4. Constraint (structural holes) ──
p4 <- ggplot(df[!is.na(df$constraint), ],
             aes(x = reorder(node, constraint), y = constraint)) +
  geom_segment(aes(xend = node, yend = 0), color = "#9ca3af") +
  geom_point(aes(color = constraint), size = 3, show.legend = FALSE) +
  scale_color_gradient(low = "#5ab4ac", high = "#e15759") +
  coord_flip() +
  labs(title = "Burt's Constraint (Structural Holes)",
       subtitle = "Low constraint = more structural hole advantage",
       x = NULL, y = "Constraint") +
  theme_minimal(base_size = 11) +
  theme(plot.title = element_text(face = "bold"))
.capture_to_base64(p4)`,
    orderIndex: 15,
  },
];

// Default templates for Python Data Science lab
const PYTHON_DEFAULT_TEMPLATES = [
  {
    title: '1. NumPy Fundamentals',
    description: 'Array creation, operations, and linear algebra basics',
    code: `import numpy as np

# Create arrays
a = np.array([1, 2, 3, 4, 5])
b = np.linspace(0, 10, 6)
mat = np.random.randn(4, 4)

print("Array a:", a)
print("Linspace b:", b)
print("\\nRandom matrix:")
print(np.round(mat, 3))

# Operations
print("\\nMean:", np.mean(mat))
print("Std:", np.round(np.std(mat), 4))
print("Eigenvalues:", np.round(np.linalg.eigvals(mat), 3))`,
    orderIndex: 0,
  },
  {
    title: '2. Pandas Data Exploration',
    description: 'Load, inspect, and summarize a dataset with pandas',
    code: `import pandas as pd
import numpy as np

np.random.seed(42)
n = 50
df = pd.DataFrame({
    'student_id': range(1, n + 1),
    'math_score': np.random.normal(75, 12, n).round(1),
    'reading_score': np.random.normal(70, 15, n).round(1),
    'study_hours': np.random.exponential(3, n).round(1),
    'grade': np.random.choice(['A', 'B', 'C', 'D'], n, p=[0.2, 0.35, 0.3, 0.15])
})

print("Shape:", df.shape)
print("\\nFirst 5 rows:")
print(df.head())
print("\\nDescriptive statistics:")
print(df.describe().round(2))
print("\\nGrade distribution:")
print(df['grade'].value_counts().sort_index())
print("\\nCorrelation matrix:")
print(df[['math_score', 'reading_score', 'study_hours']].corr().round(3))`,
    orderIndex: 1,
  },
  {
    title: '3. Matplotlib Visualizations',
    description: 'Create scatter plots, histograms, and multi-panel figures',
    code: `import matplotlib.pyplot as plt
import numpy as np

np.random.seed(42)
x = np.random.normal(0, 1, 200)
y = 0.8 * x + np.random.normal(0, 0.5, 200)
categories = np.random.choice(['A', 'B', 'C'], 200)

fig, axes = plt.subplots(2, 2, figsize=(10, 8))

# Scatter plot
colors = {'A': '#e74c3c', 'B': '#3498db', 'C': '#2ecc71'}
for cat in ['A', 'B', 'C']:
    mask = categories == cat
    axes[0, 0].scatter(x[mask], y[mask], c=colors[cat], label=cat, alpha=0.6, s=30)
axes[0, 0].set_title('Scatter Plot by Category')
axes[0, 0].legend()
axes[0, 0].set_xlabel('X')
axes[0, 0].set_ylabel('Y')

# Histogram
axes[0, 1].hist(x, bins=25, color='#3498db', alpha=0.7, edgecolor='white')
axes[0, 1].set_title('Distribution of X')
axes[0, 1].set_xlabel('Value')

# Box plot
data_by_cat = [y[categories == c] for c in ['A', 'B', 'C']]
bp = axes[1, 0].boxplot(data_by_cat, labels=['A', 'B', 'C'], patch_artist=True)
for patch, color in zip(bp['boxes'], ['#e74c3c', '#3498db', '#2ecc71']):
    patch.set_facecolor(color)
    patch.set_alpha(0.7)
axes[1, 0].set_title('Y by Category')

# Line plot
t = np.linspace(0, 4 * np.pi, 100)
axes[1, 1].plot(t, np.sin(t), label='sin', color='#e74c3c')
axes[1, 1].plot(t, np.cos(t), label='cos', color='#3498db')
axes[1, 1].set_title('Trigonometric Functions')
axes[1, 1].legend()

plt.tight_layout()
plt.show()`,
    orderIndex: 2,
  },
  {
    title: '4. Statistical Testing',
    description: 'T-tests, chi-squared tests, and correlation analysis',
    code: `import numpy as np
from scipy import stats

np.random.seed(42)

# Independent samples t-test
group_a = np.random.normal(75, 10, 30)
group_b = np.random.normal(80, 12, 30)

t_stat, p_value = stats.ttest_ind(group_a, group_b)
print("=== Independent Samples T-Test ===")
print(f"Group A: M = {group_a.mean():.2f}, SD = {group_a.std():.2f}")
print(f"Group B: M = {group_b.mean():.2f}, SD = {group_b.std():.2f}")
print(f"t = {t_stat:.3f}, p = {p_value:.4f}")
cohens_d = (group_b.mean() - group_a.mean()) / np.sqrt((group_a.std()**2 + group_b.std()**2) / 2)
print(f"Cohen's d = {cohens_d:.3f}")

# Paired t-test
pre = np.random.normal(50, 8, 25)
post = pre + np.random.normal(5, 3, 25)
t_stat, p_value = stats.ttest_rel(pre, post)
print(f"\\n=== Paired T-Test (Pre vs Post) ===")
print(f"Pre:  M = {pre.mean():.2f}")
print(f"Post: M = {post.mean():.2f}")
print(f"t = {t_stat:.3f}, p = {p_value:.4f}")

# Correlation
r, p = stats.pearsonr(group_a, group_b[:30])
print(f"\\n=== Pearson Correlation ===")
print(f"r = {r:.3f}, p = {p:.4f}")

# Chi-squared test
observed = np.array([[30, 10], [15, 25]])
chi2, p, dof, expected = stats.chi2_contingency(observed)
print(f"\\n=== Chi-Squared Test ===")
print(f"Observed:\\n{observed}")
print(f"Expected:\\n{np.round(expected, 1)}")
print(f"χ² = {chi2:.3f}, df = {dof}, p = {p:.4f}")`,
    orderIndex: 3,
  },
  {
    title: '5. Linear Regression',
    description: 'Fit and visualize a linear regression model',
    code: `import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

np.random.seed(42)
n = 60
study_hours = np.random.exponential(4, n)
exam_score = 40 + 5 * study_hours + np.random.normal(0, 8, n)
exam_score = np.clip(exam_score, 0, 100)

# Fit regression
slope, intercept, r_value, p_value, std_err = stats.linregress(study_hours, exam_score)

print("=== Linear Regression: Study Hours → Exam Score ===")
print(f"Equation: Score = {intercept:.2f} + {slope:.2f} × Hours")
print(f"R² = {r_value**2:.4f}")
print(f"p-value = {p_value:.6f}")
print(f"Standard error = {std_err:.3f}")

# Visualize
fig, axes = plt.subplots(1, 2, figsize=(12, 5))

# Scatter + regression line
x_line = np.linspace(0, study_hours.max(), 100)
y_line = intercept + slope * x_line
axes[0].scatter(study_hours, exam_score, alpha=0.6, c='#3498db', s=40)
axes[0].plot(x_line, y_line, 'r-', linewidth=2, label=f'y = {intercept:.1f} + {slope:.1f}x')
axes[0].fill_between(x_line,
    y_line - 2 * std_err * np.sqrt(1 + 1/n),
    y_line + 2 * std_err * np.sqrt(1 + 1/n),
    alpha=0.15, color='red')
axes[0].set_xlabel('Study Hours')
axes[0].set_ylabel('Exam Score')
axes[0].set_title(f'Linear Regression (R² = {r_value**2:.3f})')
axes[0].legend()

# Residual plot
predicted = intercept + slope * study_hours
residuals = exam_score - predicted
axes[1].scatter(predicted, residuals, alpha=0.6, c='#e74c3c', s=40)
axes[1].axhline(y=0, color='black', linestyle='--', linewidth=1)
axes[1].set_xlabel('Predicted Score')
axes[1].set_ylabel('Residual')
axes[1].set_title('Residual Plot')

plt.tight_layout()
plt.show()`,
    orderIndex: 4,
  },
  {
    title: '6. Machine Learning Pipeline',
    description: 'Train a classifier with scikit-learn: preprocessing, training, evaluation',
    code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Generate dataset
X, y = make_classification(n_samples=200, n_features=5, n_informative=3,
                           n_redundant=1, random_state=42)
feature_names = [f'Feature_{i+1}' for i in range(5)]

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
print(f"Training: {X_train.shape[0]} samples")
print(f"Testing:  {X_test.shape[0]} samples")

# Scale
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# Train models
models = {
    'Logistic Regression': LogisticRegression(random_state=42),
    'Decision Tree': DecisionTreeClassifier(max_depth=4, random_state=42),
}

results = {}
for name, model in models.items():
    model.fit(X_train_s, y_train)
    y_pred = model.predict(X_test_s)
    acc = accuracy_score(y_test, y_pred)
    results[name] = acc
    print(f"\\n=== {name} (Accuracy: {acc:.3f}) ===")
    print(classification_report(y_test, y_pred, digits=3))

# Plot comparison
fig, axes = plt.subplots(1, 2, figsize=(12, 5))

# Accuracy comparison
axes[0].barh(list(results.keys()), list(results.values()), color=['#3498db', '#2ecc71'])
axes[0].set_xlim(0, 1)
axes[0].set_xlabel('Accuracy')
axes[0].set_title('Model Comparison')
for i, v in enumerate(results.values()):
    axes[0].text(v + 0.01, i, f'{v:.3f}', va='center')

# Feature importance (Decision Tree)
dt = models['Decision Tree']
importance = dt.feature_importances_
idx = np.argsort(importance)
axes[1].barh([feature_names[i] for i in idx], importance[idx], color='#e74c3c')
axes[1].set_xlabel('Importance')
axes[1].set_title('Feature Importance (Decision Tree)')

plt.tight_layout()
plt.show()`,
    orderIndex: 5,
  },
];

// Default templates for Python SNA lab (networkx)
const PYTHON_SNA_DEFAULT_TEMPLATES = [
  {
    title: '1. Build a Network from an Edge List',
    description: 'Create a directed weighted network with NetworkX and visualize it',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np

# Build a directed, weighted classroom network
edges = [
    ("Alice", "Bob", 3), ("Alice", "Charlie", 2), ("Bob", "Charlie", 5),
    ("Bob", "Diana", 1), ("Charlie", "Alice", 2), ("Diana", "Eve", 4),
    ("Diana", "Frank", 3), ("Eve", "Frank", 2), ("Eve", "Grace", 5),
    ("Frank", "Grace", 1), ("Grace", "Hannah", 3), ("Grace", "Ivan", 2),
    ("Hannah", "Ivan", 4), ("Ivan", "Julia", 1), ("Ivan", "Karl", 3),
    ("Julia", "Karl", 2), ("Julia", "Laura", 5), ("Karl", "Alice", 1),
    ("Laura", "Bob", 3), ("Laura", "Diana", 2),
]

G = nx.DiGraph()
for u, v, w in edges:
    G.add_edge(u, v, weight=w)

print(f"Nodes: {G.number_of_nodes()}")
print(f"Edges: {G.number_of_edges()}")
print(f"Directed: {G.is_directed()}")

# Visualize
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
pos = nx.circular_layout(G)
weights = [G[u][v]['weight'] for u, v in G.edges()]
w_norm = [0.5 + 2.5 * (w - min(weights)) / max(1e-9, max(weights) - min(weights)) for w in weights]

palette = ['#5ab4ac','#e6ab02','#a985ca','#e15759','#5a9bd4',
           '#ed8c3b','#8bc34a','#e78ac3','#a8786a','#9580c4',
           '#66c2a5','#fc8d62']
colors = [palette[i % len(palette)] for i in range(G.number_of_nodes())]

nx.draw(G, pos, ax=axes[0], with_labels=True, node_color=colors,
        node_size=600, font_size=8, width=w_norm, edge_color='gray',
        arrows=True, arrowsize=15, font_weight='bold')
axes[0].set_title("Circle Layout")

pos_fr = nx.spring_layout(G, seed=42)
nx.draw(G, pos_fr, ax=axes[1], with_labels=True, node_color=colors,
        node_size=600, font_size=8, width=w_norm, edge_color='gray',
        arrows=True, arrowsize=15, font_weight='bold')
axes[1].set_title("Spring Layout (Fruchterman-Reingold)")

plt.tight_layout()
plt.show()`,
    orderIndex: 0,
  },
  {
    title: '2. Network Descriptive Statistics',
    description: 'Density, diameter, transitivity, reciprocity, and connectivity',
    code: `import networkx as nx
import numpy as np

# Classroom friendship network
edges = [
    ("Amy","Ben",5), ("Amy","Cat",3), ("Ben","Cat",4), ("Ben","Dan",2),
    ("Cat","Dan",3), ("Cat","Eve",5), ("Dan","Eve",2), ("Dan","Fay",4),
    ("Eve","Fay",3), ("Eve","Guy",2), ("Fay","Guy",5), ("Fay","Hal",1),
    ("Guy","Hal",3), ("Guy","Ivy",4), ("Hal","Ivy",2), ("Ivy","Jay",3),
    ("Ivy","Kim",5), ("Jay","Kim",2), ("Jay","Amy",4), ("Kim","Amy",3),
    ("Amy","Eve",1), ("Ben","Fay",2), ("Cat","Guy",3), ("Dan","Hal",1), ("Eve","Ivy",2)
]
G = nx.DiGraph()
for u, v, w in edges:
    G.add_edge(u, v, weight=w)

print("=" * 45)
print("     NETWORK DESCRIPTIVE STATISTICS")
print("=" * 45)

print(f"\\nBasic Properties:")
print(f"  Nodes:             {G.number_of_nodes()}")
print(f"  Edges:             {G.number_of_edges()}")
print(f"  Directed:          {G.is_directed()}")
print(f"  Weakly connected:  {nx.is_weakly_connected(G)}")
print(f"  Strongly connected: {nx.is_strongly_connected(G)}")

print(f"\\nStructural Metrics:")
print(f"  Density:           {nx.density(G):.4f}")
if nx.is_strongly_connected(G):
    print(f"  Diameter:          {nx.diameter(G)}")
    print(f"  Avg Path Length:   {nx.average_shortest_path_length(G):.3f}")
print(f"  Transitivity:      {nx.transitivity(G):.4f}")
print(f"  Reciprocity:       {nx.reciprocity(G):.4f}")
print(f"  Avg In-Degree:     {np.mean([d for _, d in G.in_degree()]):.2f}")
print(f"  Avg Out-Degree:    {np.mean([d for _, d in G.out_degree()]):.2f}")

print(f"\\nDegree Distribution:")
in_deg = sorted(dict(G.in_degree()).items(), key=lambda x: -x[1])
for node, deg in in_deg[:5]:
    print(f"  {node:>6}: in={deg}, out={G.out_degree(node)}")`,
    orderIndex: 1,
  },
  {
    title: '3. Centrality Analysis',
    description: 'Compare degree, betweenness, closeness, eigenvector, and PageRank',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np

# Build network
edges = [
    ("Amy","Ben",5), ("Amy","Cat",3), ("Ben","Cat",4), ("Ben","Dan",2),
    ("Cat","Dan",3), ("Cat","Eve",5), ("Dan","Eve",2), ("Dan","Fay",4),
    ("Eve","Fay",3), ("Eve","Guy",2), ("Fay","Guy",5), ("Fay","Hal",1),
    ("Guy","Hal",3), ("Guy","Ivy",4), ("Hal","Ivy",2), ("Ivy","Jay",3),
    ("Ivy","Kim",5), ("Jay","Kim",2), ("Jay","Amy",4), ("Kim","Amy",3),
]
G = nx.DiGraph()
for u, v, w in edges:
    G.add_edge(u, v, weight=w)

# Compute centralities
nodes = list(G.nodes())
centralities = {
    'In-Degree':    nx.in_degree_centrality(G),
    'Out-Degree':   nx.out_degree_centrality(G),
    'Betweenness':  nx.betweenness_centrality(G),
    'Closeness':    nx.closeness_centrality(G),
    'PageRank':     nx.pagerank(G),
}

# Print table
print(f"{'Node':>6}", end="")
for name in centralities:
    print(f"  {name:>12}", end="")
print()
print("-" * 75)
for node in sorted(nodes):
    print(f"{node:>6}", end="")
    for name, vals in centralities.items():
        print(f"  {vals[node]:>12.4f}", end="")
    print()

# Visualize
fig, axes = plt.subplots(1, 2, figsize=(14, 6))

# Bar chart
measures = ['In-Degree', 'Betweenness', 'PageRank']
x = np.arange(len(nodes))
width = 0.25
colors_bar = ['#5ab4ac', '#e6ab02', '#e15759']
sorted_nodes = sorted(nodes)
for i, m in enumerate(measures):
    vals = [centralities[m][n] for n in sorted_nodes]
    axes[0].bar(x + i * width, vals, width, label=m, color=colors_bar[i])
axes[0].set_xticks(x + width)
axes[0].set_xticklabels(sorted_nodes, rotation=45, fontsize=8)
axes[0].set_ylabel('Centrality')
axes[0].set_title('Centrality Comparison')
axes[0].legend(fontsize=8)

# Network sized by betweenness
pos = nx.spring_layout(G, seed=42)
bt = centralities['Betweenness']
sizes = [300 + 3000 * bt[n] for n in G.nodes()]
palette = ['#5ab4ac','#e6ab02','#a985ca','#e15759','#5a9bd4',
           '#ed8c3b','#8bc34a','#e78ac3','#a8786a','#9580c4']
node_colors = [palette[i % len(palette)] for i in range(len(G.nodes()))]
nx.draw(G, pos, ax=axes[1], with_labels=True, node_size=sizes,
        node_color=node_colors, font_size=7, arrows=True, arrowsize=12,
        edge_color='gray', width=0.8, font_weight='bold')
axes[1].set_title('Node size = Betweenness Centrality')

plt.tight_layout()
plt.show()`,
    orderIndex: 2,
  },
  {
    title: '4. Community Detection',
    description: 'Detect and visualize communities using Louvain and greedy modularity',
    code: `import networkx as nx
import matplotlib.pyplot as plt
from networkx.algorithms.community import greedy_modularity_communities, louvain_communities
import numpy as np

# Stochastic block model — 3 communities
sizes = [10, 10, 10]
probs = [[0.5, 0.05, 0.02],
         [0.05, 0.4, 0.03],
         [0.02, 0.03, 0.45]]
G = nx.stochastic_block_model(sizes, probs, seed=42)
G = nx.relabel_nodes(G, {i: f"N{i+1}" for i in range(30)})

# Detect communities
louvain = louvain_communities(G, seed=42)
greedy = greedy_modularity_communities(G)

palette = ['#5ab4ac','#e6ab02','#a985ca','#e15759','#5a9bd4',
           '#ed8c3b','#8bc34a','#e78ac3','#a8786a','#9580c4']

def community_colors(communities, G):
    color_map = {}
    for i, comm in enumerate(communities):
        for node in comm:
            color_map[node] = palette[i % len(palette)]
    return [color_map[n] for n in G.nodes()]

fig, axes = plt.subplots(1, 2, figsize=(14, 6))
pos = nx.spring_layout(G, seed=42)

# Louvain
colors_l = community_colors(louvain, G)
nx.draw(G, pos, ax=axes[0], with_labels=True, node_color=colors_l,
        node_size=400, font_size=7, edge_color='gray', width=0.5)
axes[0].set_title(f"Louvain ({len(louvain)} communities)")

# Greedy modularity
colors_g = community_colors(greedy, G)
nx.draw(G, pos, ax=axes[1], with_labels=True, node_color=colors_g,
        node_size=400, font_size=7, edge_color='gray', width=0.5)
axes[1].set_title(f"Greedy Modularity ({len(greedy)} communities)")

plt.tight_layout()
plt.show()

# Print memberships
print("=== Louvain Communities ===")
for i, comm in enumerate(louvain):
    print(f"  Community {i+1} ({len(comm)} nodes): {', '.join(sorted(comm))}")

print(f"\\n=== Greedy Modularity Communities ===")
for i, comm in enumerate(greedy):
    print(f"  Community {i+1} ({len(comm)} nodes): {', '.join(sorted(comm))}")`,
    orderIndex: 3,
  },
  {
    title: '5. Degree Distribution & Scale-Free Test',
    description: 'Analyze degree distribution and test for power-law behavior',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from collections import Counter

# Compare random vs scale-free networks
G_er = nx.erdos_renyi_graph(200, 0.03, seed=42)
G_ba = nx.barabasi_albert_graph(200, 2, seed=42)

fig, axes = plt.subplots(2, 2, figsize=(12, 10))

for idx, (G, name) in enumerate([(G_er, "Erdős-Rényi (Random)"), (G_ba, "Barabási-Albert (Scale-Free)")]):
    degrees = [d for _, d in G.degree()]
    deg_count = Counter(degrees)

    # Histogram
    axes[0, idx].hist(degrees, bins=range(max(degrees)+2), color=['#3498db', '#e74c3c'][idx],
                       alpha=0.7, edgecolor='white', align='left')
    axes[0, idx].set_title(f'{name}\\nDegree Distribution')
    axes[0, idx].set_xlabel('Degree')
    axes[0, idx].set_ylabel('Count')

    # Log-log plot
    x = sorted(deg_count.keys())
    y = [deg_count[k] for k in x]
    axes[1, idx].loglog(x, y, 'o', color=['#3498db', '#e74c3c'][idx], markersize=5)
    axes[1, idx].set_title(f'{name}\\nLog-Log Degree Distribution')
    axes[1, idx].set_xlabel('Degree (log)')
    axes[1, idx].set_ylabel('Count (log)')
    axes[1, idx].grid(True, alpha=0.3)

    print(f"=== {name} ===")
    print(f"  Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}")
    print(f"  Avg Degree: {np.mean(degrees):.2f}")
    print(f"  Max Degree: {max(degrees)}")
    print(f"  Density: {nx.density(G):.4f}")
    print(f"  Clustering: {nx.average_clustering(G):.4f}")
    print()

plt.tight_layout()
plt.show()`,
    orderIndex: 4,
  },
  {
    title: '6. Network Resilience',
    description: 'Compare targeted attacks vs random failures on network connectivity',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np

# Scale-free network
G = nx.barabasi_albert_graph(80, 2, seed=42)
print(f"Original: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"Connected: {nx.is_connected(G)}\\n")

steps = 20
targeted_lcc = [G.number_of_nodes()]
random_lcc = [G.number_of_nodes()]

# Targeted attack — remove highest-degree nodes
G_attack = G.copy()
for i in range(steps):
    if G_attack.number_of_nodes() == 0:
        break
    target = max(G_attack.degree(), key=lambda x: x[1])[0]
    G_attack.remove_node(target)
    lcc = max(len(c) for c in nx.connected_components(G_attack)) if G_attack.number_of_nodes() > 0 else 0
    targeted_lcc.append(lcc)

# Random failure
G_random = G.copy()
rng = np.random.default_rng(42)
for i in range(steps):
    if G_random.number_of_nodes() == 0:
        break
    target = rng.choice(list(G_random.nodes()))
    G_random.remove_node(target)
    lcc = max(len(c) for c in nx.connected_components(G_random)) if G_random.number_of_nodes() > 0 else 0
    random_lcc.append(lcc)

# Plot
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

axes[0].plot(range(len(targeted_lcc)), targeted_lcc, 'o-', color='#e74c3c', label='Targeted Attack', markersize=4)
axes[0].plot(range(len(random_lcc)), random_lcc, 's-', color='#3498db', label='Random Failure', markersize=4)
axes[0].set_xlabel('Nodes Removed')
axes[0].set_ylabel('Largest Connected Component')
axes[0].set_title('Network Resilience')
axes[0].legend()
axes[0].grid(True, alpha=0.3)

# Show original network
pos = nx.spring_layout(G, seed=42)
degrees = dict(G.degree())
sizes = [30 + 8 * degrees[n] for n in G.nodes()]
nx.draw(G, pos, ax=axes[1], node_size=sizes, node_color='#5ab4ac',
        edge_color='gray', width=0.3, with_labels=False, alpha=0.8)
axes[1].set_title('Original Scale-Free Network\\n(node size = degree)')

plt.tight_layout()
plt.show()

print("Targeted attack collapses the network much faster!")
print(f"After {steps} removals:")
print(f"  Targeted: LCC = {targeted_lcc[-1]} ({targeted_lcc[-1]/G.number_of_nodes()*100:.1f}%)")
print(f"  Random:   LCC = {random_lcc[-1]} ({random_lcc[-1]/G.number_of_nodes()*100:.1f}%)")`,
    orderIndex: 5,
  },
  {
    title: '7. Ego Networks & Structural Holes',
    description: 'Analyze ego networks, constraint, and brokerage positions',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np

# Collaboration network
edges = [
    ("Alice","Bob"), ("Alice","Charlie"), ("Alice","Diana"),
    ("Bob","Charlie"), ("Bob","Eve"), ("Charlie","Diana"),
    ("Diana","Frank"), ("Diana","Grace"),
    ("Eve","Frank"), ("Eve","Hannah"),
    ("Frank","Grace"), ("Frank","Hannah"), ("Frank","Ivan"),
    ("Grace","Ivan"), ("Hannah","Ivan"),
    ("Ivan","Julia"), ("Ivan","Karl"),
    ("Julia","Karl"), ("Julia","Laura"),
    ("Karl","Laura"),
]
G = nx.Graph(edges)

# Compute ego network metrics
print("=== Ego Network Analysis ===\\n")
print(f"{'Node':>8} {'Ego Size':>9} {'Ego Edges':>10} {'Ego Density':>12} {'Constraint':>11}")
print("-" * 55)

constraints = {}
for node in sorted(G.nodes()):
    ego = nx.ego_graph(G, node)
    n_ego = ego.number_of_nodes() - 1
    e_ego = ego.number_of_edges() - n_ego  # edges among alters
    max_edges = n_ego * (n_ego - 1) / 2 if n_ego > 1 else 1
    density = e_ego / max_edges if max_edges > 0 else 0

    # Burt's constraint (simplified)
    constraint = 0
    neighbors = list(G.neighbors(node))
    n_j = len(neighbors)
    for j in neighbors:
        p_ij = 1 / n_j
        indirect = sum(1 / len(list(G.neighbors(q))) for q in neighbors if G.has_edge(j, q))
        c_ij = (p_ij + indirect / max(1, n_j)) ** 2
        constraint += c_ij
    constraints[node] = round(constraint, 4)

    print(f"{node:>8} {n_ego:>9} {e_ego:>10} {density:>12.3f} {constraint:>11.4f}")

# Visualize
fig, axes = plt.subplots(1, 2, figsize=(14, 6))

pos = nx.spring_layout(G, seed=42)
# Color by constraint (low = broker)
vals = [constraints[n] for n in G.nodes()]
sizes = [300 + 800 * (1 - c / max(vals)) for c in vals]

nx.draw(G, pos, ax=axes[0], with_labels=True, node_color=vals,
        cmap=plt.cm.RdYlGn_r, node_size=sizes, font_size=8,
        edge_color='gray', width=0.8, font_weight='bold')
axes[0].set_title("Constraint (red = high, green = low/broker)")

# Bar chart
sorted_nodes = sorted(constraints.keys(), key=lambda x: constraints[x])
axes[1].barh(sorted_nodes, [constraints[n] for n in sorted_nodes],
             color=['#2ecc71' if constraints[n] < np.median(vals) else '#e74c3c' for n in sorted_nodes])
axes[1].set_xlabel("Burt's Constraint")
axes[1].set_title("Structural Holes (low constraint = broker)")

plt.tight_layout()
plt.show()`,
    orderIndex: 6,
  },
  {
    title: '8. Adjacency Matrix Heatmap',
    description: 'Visualize the adjacency matrix and reorder by community',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from networkx.algorithms.community import louvain_communities

# Build network with community structure
sizes = [8, 8, 8]
probs = [[0.6, 0.05, 0.02],
         [0.05, 0.5, 0.03],
         [0.02, 0.03, 0.55]]
G = nx.stochastic_block_model(sizes, probs, seed=42)
nodes = list(G.nodes())

# Original adjacency matrix
adj = nx.to_numpy_array(G)

# Community-ordered adjacency matrix
communities = louvain_communities(G, seed=42)
ordered_nodes = []
for comm in communities:
    ordered_nodes.extend(sorted(comm))
adj_ordered = nx.to_numpy_array(G, nodelist=ordered_nodes)

fig, axes = plt.subplots(1, 2, figsize=(14, 6))
cmap = plt.cm.Blues

im1 = axes[0].imshow(adj, cmap=cmap, interpolation='none')
axes[0].set_title("Original Adjacency Matrix")
axes[0].set_xlabel("Node")
axes[0].set_ylabel("Node")
plt.colorbar(im1, ax=axes[0], shrink=0.8)

im2 = axes[1].imshow(adj_ordered, cmap=cmap, interpolation='none')
axes[1].set_title("Reordered by Community")
axes[1].set_xlabel("Node (community-ordered)")
axes[1].set_ylabel("Node (community-ordered)")
plt.colorbar(im2, ax=axes[1], shrink=0.8)

# Draw community boundaries
offset = 0
for comm in communities:
    size = len(comm)
    rect = plt.Rectangle((offset - 0.5, offset - 0.5), size, size,
                          fill=False, edgecolor='red', linewidth=2)
    axes[1].add_patch(rect)
    offset += size

plt.tight_layout()
plt.show()

print("Notice the block-diagonal structure after community reordering!")
print(f"Communities found: {len(communities)}")
for i, comm in enumerate(communities):
    print(f"  Community {i+1}: {sorted(comm)}")`,
    orderIndex: 7,
  },
  {
    title: '9. Complete SNA Pipeline',
    description: 'End-to-end analysis of a classroom collaboration network',
    code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from networkx.algorithms.community import louvain_communities

# Generate classroom collaboration network
rng = np.random.default_rng(123)
students = [f"S{i:02d}" for i in range(1, 21)]
G = nx.DiGraph()
G.add_nodes_from(students)
for _ in range(50):
    u, v = rng.choice(students, 2, replace=False)
    if not G.has_edge(u, v):
        G.add_edge(u, v, weight=int(rng.integers(1, 6)))

print("=" * 50)
print("   CLASSROOM COLLABORATION NETWORK ANALYSIS")
print("=" * 50)
print(f"\\nStudents: {G.number_of_nodes()}")
print(f"Connections: {G.number_of_edges()}")
print(f"Density: {nx.density(G):.3f}")
print(f"Reciprocity: {nx.reciprocity(G):.3f}")

# Key players
pr = nx.pagerank(G)
bt = nx.betweenness_centrality(G)
print(f"\\nTop 5 by PageRank:")
for node, val in sorted(pr.items(), key=lambda x: -x[1])[:5]:
    print(f"  {node}: {val:.4f}")
print(f"\\nTop 5 by Betweenness:")
for node, val in sorted(bt.items(), key=lambda x: -x[1])[:5]:
    print(f"  {node}: {val:.4f}")

# Community detection
G_undir = G.to_undirected()
communities = louvain_communities(G_undir, seed=42)
print(f"\\nCommunities (Louvain): {len(communities)}")
for i, comm in enumerate(communities):
    print(f"  Group {i+1}: {', '.join(sorted(comm))}")

# Comprehensive visualization
fig, axes = plt.subplots(2, 2, figsize=(14, 12))

pos = nx.spring_layout(G, seed=42)
palette = ['#5ab4ac','#e6ab02','#a985ca','#e15759','#5a9bd4','#ed8c3b']

# 1. Network by PageRank
sizes = [200 + 4000 * pr[n] for n in G.nodes()]
nx.draw(G, pos, ax=axes[0, 0], with_labels=True, node_size=sizes,
        node_color='#5ab4ac', font_size=7, arrows=True, arrowsize=10,
        edge_color='gray', width=0.5, font_weight='bold')
axes[0, 0].set_title("Network (size = PageRank)")

# 2. Communities
comm_colors = {}
for i, comm in enumerate(communities):
    for node in comm:
        comm_colors[node] = palette[i % len(palette)]
colors = [comm_colors[n] for n in G.nodes()]
nx.draw(G, pos, ax=axes[0, 1], with_labels=True, node_color=colors,
        node_size=400, font_size=7, arrows=True, arrowsize=10,
        edge_color='gray', width=0.5, font_weight='bold')
axes[0, 1].set_title(f"Communities (Louvain, {len(communities)} groups)")

# 3. Centrality comparison
sorted_students = sorted(students)
measures = {'PageRank': pr, 'Betweenness': bt}
x = np.arange(len(sorted_students))
width = 0.35
for i, (name, vals) in enumerate(measures.items()):
    axes[1, 0].bar(x + i * width, [vals[s] for s in sorted_students],
                    width, label=name, color=['#3498db', '#e74c3c'][i])
axes[1, 0].set_xticks(x + width / 2)
axes[1, 0].set_xticklabels(sorted_students, rotation=45, fontsize=7)
axes[1, 0].set_ylabel('Centrality')
axes[1, 0].set_title('Centrality Comparison')
axes[1, 0].legend(fontsize=8)

# 4. In/Out degree scatter
in_deg = dict(G.in_degree())
out_deg = dict(G.out_degree())
axes[1, 1].scatter([in_deg[n] for n in students], [out_deg[n] for n in students],
                    s=100, c='#e6ab02', alpha=0.7, edgecolors='black', linewidth=0.5)
for n in students:
    axes[1, 1].annotate(n, (in_deg[n], out_deg[n]), fontsize=6, ha='center', va='bottom')
axes[1, 1].set_xlabel('In-Degree')
axes[1, 1].set_ylabel('Out-Degree')
axes[1, 1].set_title('In-Degree vs Out-Degree')
axes[1, 1].axline((0, 0), slope=1, color='gray', linestyle='--', alpha=0.5)

plt.tight_layout()
plt.show()`,
    orderIndex: 8,
  },
];

// Map lab types to their default templates
const DEFAULT_TEMPLATES_MAP: Record<string, typeof TNA_DEFAULT_TEMPLATES> = {
  tna: TNA_DEFAULT_TEMPLATES,
  statistics: STATISTICS_DEFAULT_TEMPLATES,
  network: NETWORK_DEFAULT_TEMPLATES,
  sna: SNA_DEFAULT_TEMPLATES,
  mslq: MSLQ_DEFAULT_TEMPLATES,
  colles: COLLES_DEFAULT_TEMPLATES,
  spq: SPQ_DEFAULT_TEMPLATES,
  python: PYTHON_DEFAULT_TEMPLATES,
  'python-data': PYTHON_DEFAULT_TEMPLATES,
  'python-ml': PYTHON_DEFAULT_TEMPLATES,
  'python-stats': PYTHON_DEFAULT_TEMPLATES,
  'python-viz': PYTHON_DEFAULT_TEMPLATES,
  'python-sna': PYTHON_SNA_DEFAULT_TEMPLATES,
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
  async assignToCourse(
    labId: number,
    courseId: number,
    moduleId: number | null,
    userId: number,
    isAdmin = false,
    assignmentConfig?: { prompt?: string; points?: number; dueDate?: string; gracePeriodDeadline?: string }
  ) {
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

    // Create Assignment + LabAssignment atomically
    const assignment = await prisma.$transaction(async (tx) => {
      let createdAssignmentId: number | undefined;
      if (assignmentConfig) {
        const newAssignment = await tx.assignment.create({
          data: {
            courseId,
            moduleId,
            title: lab.name,
            description: assignmentConfig.prompt,
            submissionType: 'mixed',
            isPublished: true,
            points: assignmentConfig.points ?? 100,
            dueDate: assignmentConfig.dueDate ? new Date(assignmentConfig.dueDate) : null,
            gracePeriodDeadline: assignmentConfig.gracePeriodDeadline ? new Date(assignmentConfig.gracePeriodDeadline) : null,
          },
        });
        createdAssignmentId = newAssignment.id;
      }

      return tx.labAssignment.create({
        data: {
          labId,
          courseId,
          moduleId,
          assignmentId: createdAssignmentId ?? null,
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
          assignment: {
            select: { id: true, description: true, points: true, dueDate: true },
          },
        },
      });
    });

    return assignment;
  }

  /**
   * Get lab assignment config (with linked Assignment) for a specific lab+course
   */
  async getLabAssignmentConfig(labId: number, courseId: number) {
    const labAssignment = await prisma.labAssignment.findFirst({
      where: { labId, courseId },
      orderBy: { id: 'desc' },
      include: {
        assignment: {
          select: { id: true, description: true, points: true, dueDate: true },
        },
      },
    });
    return labAssignment;
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

    const assignment = await prisma.labAssignment.findFirst({
      where: { labId, courseId },
    });

    if (!assignment) {
      throw new AppError('Lab assignment not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.labAssignment.delete({
        where: { id: assignment.id },
      });

      // Also delete the linked assignment to avoid orphans
      if (assignment.assignmentId) {
        await tx.assignment.delete({
          where: { id: assignment.assignmentId },
        });
      }
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
      // R Labs
      { id: 'tna', name: 'TNA Lab (R)', description: 'Transition Network Analysis using the tna R package' },
      { id: 'sna', name: 'SNA Lab (R)', description: 'Social Network Analysis with igraph — centrality, communities, resilience, and more' },
      { id: 'statistics', name: 'Statistics Lab (R)', description: 'Basic statistics and data analysis in R' },
      { id: 'network', name: 'Network Analysis (R)', description: 'General network and graph analysis' },
      { id: 'dataviz', name: 'Data Visualization (R)', description: 'Create visualizations with ggplot2' },
      { id: 'custom', name: 'Custom R Lab', description: 'Create your own custom R lab' },
      // Python Labs
      { id: 'python', name: 'Python Lab', description: 'General Python with NumPy, Pandas, and Matplotlib' },
      { id: 'python-data', name: 'Python Data Science', description: 'Data analysis with pandas, scipy, and scikit-learn' },
      { id: 'python-ml', name: 'Python ML', description: 'Machine learning with scikit-learn' },
      { id: 'python-stats', name: 'Python Statistics', description: 'Statistical analysis with scipy and statsmodels' },
      { id: 'python-viz', name: 'Python Visualization', description: 'Data visualization with matplotlib' },
      { id: 'python-sna', name: 'Python SNA', description: 'Social Network Analysis with NetworkX — centrality, communities, resilience' },
    ];
  }
}

export const customLabService = new CustomLabService();
