import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding custom labs and templates...');

  // Get admin user for createdBy
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (!admin) {
    throw new Error('Admin user not found. Run the main seed first.');
  }

  /* === Other labs commented out — only seeding Karate Club ===

  // =========================================================================
  // TNA Lab
  // =========================================================================
  const tnaLab = await prisma.customLab.findFirst({ where: { name: 'TNA Lab', labType: 'tna' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'TNA Lab',
        description: 'Transition Network Analysis - Explore group regulation patterns using the TNA R package',
        labType: 'tna',
        isPublic: true,
        createdBy: admin.id,
      },
    });

  const tnaTemplates = [
    { title: 'Load Data & Create Model', description: 'Load the TNA package and sample data, then create a transition network model', code: 'library(tna)\ndata(group_regulation)\nModel <- tna(group_regulation)\nprint(Model)', orderIndex: 0 },
    { title: 'View Centralities', description: 'Calculate and view centrality measures for the network', code: 'cent <- centralities(Model)\nprint(cent)', orderIndex: 1 },
    { title: 'Plot Centralities', description: 'Create a visualization of the centrality measures', code: 'p <- plot(centralities(Model))\nprint(p)', orderIndex: 2 },
    { title: 'Plot Network', description: 'Create a network visualization using circle layout', code: '# Plot the transition network with circle layout\nggplot_tna(Model, layout = "circle")', orderIndex: 3 },
    { title: 'Network Summary', description: 'View summary statistics of the transition network', code: '# View network summary\nsummary(Model)', orderIndex: 4 },
  ];

  const existingTnaTemplates = await prisma.labTemplate.count({ where: { labId: tnaLab.id } });
  if (existingTnaTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: tnaTemplates.map(t => ({ ...t, labId: tnaLab.id })),
    });
  }

  // =========================================================================
  // Statistics Lab
  // =========================================================================
  const statsLab = await prisma.customLab.findFirst({ where: { name: 'Statistics Lab', labType: 'statistics' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'Statistics Lab',
        description: 'Statistical Analysis - Perform common statistical tests and analyses using R',
        labType: 'statistics',
        isPublic: true,
        createdBy: admin.id,
      },
    });

  const statsTemplates = [
    { title: 'Load Sample Data', description: 'Load the mtcars dataset for demonstration', code: '# Load sample data\ndata(mtcars)\nhead(mtcars)\n\n# Quick overview\nstr(mtcars)', orderIndex: 0 },
    { title: 'Descriptive Statistics', description: 'Calculate summary statistics for numeric variables', code: '# Descriptive statistics\nsummary(mtcars)\n\n# Detailed descriptive stats\ndescriptives <- data.frame(\n  Variable = names(mtcars),\n  N = sapply(mtcars, length),\n  Mean = sapply(mtcars, mean),\n  SD = sapply(mtcars, sd),\n  Min = sapply(mtcars, min),\n  Max = sapply(mtcars, max)\n)\nprint(descriptives, row.names = FALSE)', orderIndex: 1 },
    { title: 'Independent t-test', description: 'Compare means between two groups', code: '# Independent samples t-test\nauto <- mtcars$mpg[mtcars$am == 0]\nmanual <- mtcars$mpg[mtcars$am == 1]\n\nt_result <- t.test(auto, manual)\nprint(t_result)\n\ncohens_d <- (mean(manual) - mean(auto)) / sqrt((sd(auto)^2 + sd(manual)^2) / 2)\ncat("\\nCohen\'s d:", round(cohens_d, 3))', orderIndex: 2 },
    { title: 'Correlation Analysis', description: 'Examine relationships between variables', code: '# Correlation analysis\nvars <- mtcars[, c("mpg", "hp", "wt", "qsec")]\ncor_matrix <- cor(vars)\nprint(round(cor_matrix, 3))\n\ncat("\\nMPG vs Weight:")\nprint(cor.test(mtcars$mpg, mtcars$wt))', orderIndex: 3 },
    { title: 'Linear Regression', description: 'Fit a linear regression model', code: '# Linear regression\nmodel <- lm(mpg ~ wt + hp, data = mtcars)\nsummary(model)', orderIndex: 4 },
  ];

  const existingStatsTemplates = await prisma.labTemplate.count({ where: { labId: statsLab.id } });
  if (existingStatsTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: statsTemplates.map(t => ({ ...t, labId: statsLab.id })),
    });
  }

  // =========================================================================
  // MSLQ Survey Lab (Pintrich et al., 1991)
  // =========================================================================
  const mslqLab = await prisma.customLab.findFirst({ where: { name: 'MSLQ Survey Analysis', labType: 'mslq' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'MSLQ Survey Analysis',
        description: 'Motivated Strategies for Learning Questionnaire (Pintrich et al., 1991) — Analyze motivation and self-regulated learning strategies and their relationship to academic achievement.',
        labType: 'mslq',
        isPublic: true,
        createdBy: admin.id,
      },
    });
  const existingMslqTemplates = await prisma.labTemplate.count({ where: { labId: mslqLab.id } });
  if (existingMslqTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [
        { labId: mslqLab.id, title: 'Create MSLQ Data', description: 'Simulate MSLQ data with motivation and learning strategy subscales', orderIndex: 0, code: `# Motivated Strategies for Learning Questionnaire (MSLQ)
# Reference: Pintrich et al. (1991)
set.seed(42)
n <- 80

likert7 <- function(n, mu, sd) round(pmin(7, pmax(1, rnorm(n, mu, sd))), 0)

mslq <- data.frame(
  student_id = 1:n,
  intrinsic_goal = likert7(n, 4.8, 1.2),
  extrinsic_goal = likert7(n, 4.2, 1.4),
  task_value = likert7(n, 5.0, 1.1),
  self_efficacy = likert7(n, 4.5, 1.3),
  test_anxiety = likert7(n, 3.8, 1.5),
  rehearsal = likert7(n, 4.0, 1.3),
  elaboration = likert7(n, 4.5, 1.2),
  critical_thinking = likert7(n, 4.2, 1.3),
  metacognition = likert7(n, 4.6, 1.1)
)

mslq$final_grade <- round(pmin(100, pmax(30,
  40 + mslq$self_efficacy * 3 + mslq$metacognition * 2.5 +
  mslq$elaboration * 1.5 - mslq$test_anxiety * 1.2 + rnorm(n, 0, 8)
)), 1)

str(mslq)
summary(mslq[, -1])` },
        { labId: mslqLab.id, title: 'Reliability & Descriptives', description: 'Compute descriptives and correlations for MSLQ scales', orderIndex: 1, code: `# Descriptive statistics and correlations with final grade
all_vars <- c("intrinsic_goal", "extrinsic_goal", "task_value",
              "self_efficacy", "test_anxiety", "rehearsal",
              "elaboration", "critical_thinking", "metacognition")

cat("=== MSLQ Subscale Descriptives ===\\n")
for (v in all_vars) {
  cat(sprintf("%-18s  M = %.2f  SD = %.2f\\n", v, mean(mslq[[v]]), sd(mslq[[v]])))
}

cat("\\n=== Correlations with Final Grade ===\\n")
for (v in all_vars) {
  r <- cor(mslq[[v]], mslq$final_grade)
  p <- cor.test(mslq[[v]], mslq$final_grade)$p.value
  sig <- ifelse(p < 0.001, "***", ifelse(p < 0.01, "**", ifelse(p < 0.05, "*", "")))
  cat(sprintf("%-18s  r = %+.3f  %s\\n", v, r, sig))
}` },
        { labId: mslqLab.id, title: 'Visualize & Predict', description: 'Visualize scales and predict achievement from MSLQ', orderIndex: 2, code: `library(ggplot2)
library(tidyr)

# Boxplot of all subscales
mslq_long <- mslq[, c("intrinsic_goal","self_efficacy","metacognition",
                       "elaboration","test_anxiety")] |>
  pivot_longer(everything(), names_to = "subscale", values_to = "score")

ggplot(mslq_long, aes(x = reorder(subscale, score, FUN = median), y = score, fill = subscale)) +
  geom_boxplot(show.legend = FALSE) + coord_flip() +
  labs(title = "MSLQ Subscale Distributions", x = NULL, y = "Score (1-7)") +
  theme_minimal()

# Regression
cat("\\n=== Regression: MSLQ -> Final Grade ===\\n")
model <- lm(final_grade ~ self_efficacy + metacognition + elaboration + test_anxiety, data = mslq)
summary(model)` },
      ],
    });
  }

  // =========================================================================
  // COLLES Survey Lab (Taylor & Maor, 2000)
  // =========================================================================
  const collesLab = await prisma.customLab.findFirst({ where: { name: 'COLLES Survey Analysis', labType: 'colles' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'COLLES Survey Analysis',
        description: 'Constructivist On-Line Learning Environment Survey (Taylor & Maor, 2000) — Evaluate online learning environments across relevance, reflective thinking, interactivity, tutor support, peer support, and interpretation.',
        labType: 'colles',
        isPublic: true,
        createdBy: admin.id,
      },
    });
  const existingCollesTemplates = await prisma.labTemplate.count({ where: { labId: collesLab.id } });
  if (existingCollesTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [
        { labId: collesLab.id, title: 'Create COLLES Data', description: 'Simulate COLLES survey responses across 6 dimensions', orderIndex: 0, code: `# Constructivist On-Line Learning Environment Survey (COLLES)
# Reference: Taylor, P. C., & Maor, D. (2000)
set.seed(123)
n <- 65

likert5 <- function(n, mu, sd) round(pmin(5, pmax(1, rnorm(n, mu, sd))), 0)

colles <- data.frame(
  student_id = 1:n,
  relevance = likert5(n, 3.8, 0.9),
  reflective_thinking = likert5(n, 3.5, 1.0),
  interactivity = likert5(n, 3.2, 1.1),
  tutor_support = likert5(n, 3.9, 0.8),
  peer_support = likert5(n, 3.3, 1.0),
  interpretation = likert5(n, 3.6, 0.9),
  satisfaction = likert5(n, 3.7, 0.9)
)

cat("COLLES Dataset (Taylor & Maor, 2000)\\n")
str(colles)
summary(colles[, -1])` },
        { labId: collesLab.id, title: 'Analyze COLLES Scales', description: 'Compare scale means and identify strengths/weaknesses', orderIndex: 1, code: `library(ggplot2)
scales <- c("relevance","reflective_thinking","interactivity",
            "tutor_support","peer_support","interpretation")

cat("=== COLLES Scale Descriptives ===\\n")
for (s in scales) {
  m <- mean(colles[[s]]); sd_val <- sd(colles[[s]])
  pct_pos <- mean(colles[[s]] >= 4) * 100
  cat(sprintf("%-22s  M = %.2f  SD = %.2f  %%Positive = %.1f%%\\n", s, m, sd_val, pct_pos))
}

# Diverging bar chart from neutral
scale_means <- sapply(colles[, scales], mean)
df_plot <- data.frame(
  scale = factor(names(scale_means), levels = rev(names(scale_means))),
  deviation = scale_means - 3
)

ggplot(df_plot, aes(x = scale, y = deviation, fill = deviation > 0)) +
  geom_col(show.legend = FALSE) + coord_flip() +
  scale_fill_manual(values = c("#e74c3c", "#27ae60")) +
  labs(title = "COLLES: Deviation from Neutral (3.0)", x = NULL, y = "Mean - 3.0") +
  theme_minimal()` },
        { labId: collesLab.id, title: 'Predict Satisfaction', description: 'Model which dimensions best predict overall satisfaction', orderIndex: 2, code: `library(ggplot2)

model <- lm(satisfaction ~ relevance + reflective_thinking + interactivity +
            tutor_support + peer_support + interpretation, data = colles)
cat("=== Predicting Satisfaction from COLLES Scales ===\\n")
summary(model)

# Standardized coefficients
colles_sc <- as.data.frame(scale(colles[, -1]))
model_std <- lm(satisfaction ~ ., data = colles_sc)
coefs <- data.frame(predictor = names(coef(model_std))[-1], beta = coef(model_std)[-1])
coefs$predictor <- factor(coefs$predictor, levels = coefs$predictor[order(abs(coefs$beta))])

ggplot(coefs, aes(x = predictor, y = beta, fill = beta > 0)) +
  geom_col(show.legend = FALSE) + coord_flip() +
  scale_fill_manual(values = c("#e74c3c", "#2980b9")) +
  labs(title = "Standardized Predictors of Satisfaction (COLLES)", x = NULL, y = "Beta") +
  theme_minimal()` },
      ],
    });
  }

  // =========================================================================
  // R-SPQ-2F Survey Lab (Biggs et al., 2001)
  // =========================================================================
  const spqLab = await prisma.customLab.findFirst({ where: { name: 'R-SPQ-2F Survey Analysis', labType: 'spq' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'R-SPQ-2F Survey Analysis',
        description: 'Revised Study Process Questionnaire (Biggs, Kember & Leung, 2001) — Measure deep vs surface approaches to learning and their impact on academic performance.',
        labType: 'spq',
        isPublic: true,
        createdBy: admin.id,
      },
    });
  const existingSpqTemplates = await prisma.labTemplate.count({ where: { labId: spqLab.id } });
  if (existingSpqTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [
        { labId: spqLab.id, title: 'Create R-SPQ-2F Data', description: 'Simulate SPQ data with deep/surface approach scales', orderIndex: 0, code: `# Revised Two-Factor Study Process Questionnaire (R-SPQ-2F)
# Reference: Biggs, Kember & Leung (2001)
set.seed(99)
n <- 90

likert5 <- function(n, mu, sd) round(pmin(5, pmax(1, rnorm(n, mu, sd))), 0)

spq <- data.frame(
  student_id = 1:n,
  deep_motive = likert5(n, 3.6, 0.8),
  deep_strategy = likert5(n, 3.4, 0.9),
  surface_motive = likert5(n, 2.8, 0.9),
  surface_strategy = likert5(n, 2.6, 1.0),
  year = sample(1:4, n, replace = TRUE, prob = c(0.35, 0.30, 0.20, 0.15))
)

spq$deep_approach <- round((spq$deep_motive + spq$deep_strategy) / 2, 2)
spq$surface_approach <- round((spq$surface_motive + spq$surface_strategy) / 2, 2)
spq$gpa <- round(pmin(4.0, pmax(1.0,
  2.0 + spq$deep_motive * 0.15 + spq$deep_strategy * 0.15 -
  spq$surface_motive * 0.1 - spq$surface_strategy * 0.1 + rnorm(n, 0, 0.4)
)), 2)

cat("R-SPQ-2F Dataset (Biggs et al., 2001)\\n")
str(spq)
summary(spq[, c("deep_approach", "surface_approach", "gpa")])` },
        { labId: spqLab.id, title: 'Compare Approaches', description: 'Analyze deep vs surface approaches across year levels', orderIndex: 1, code: `library(dplyr)
library(ggplot2)
library(tidyr)

cat("=== Deep vs Surface Approach ===\\n")
cat(sprintf("Deep:    M = %.2f  SD = %.2f\\n", mean(spq$deep_approach), sd(spq$deep_approach)))
cat(sprintf("Surface: M = %.2f  SD = %.2f\\n", mean(spq$surface_approach), sd(spq$surface_approach)))
print(t.test(spq$deep_approach, spq$surface_approach, paired = TRUE))

# By year
spq_long <- spq |>
  select(student_id, year, deep_approach, surface_approach) |>
  pivot_longer(c(deep_approach, surface_approach), names_to = "approach", values_to = "score")

ggplot(spq_long, aes(x = factor(year), y = score, fill = approach)) +
  geom_boxplot() +
  scale_fill_manual(values = c("deep_approach" = "#2980b9", "surface_approach" = "#e74c3c"),
                    labels = c("Deep", "Surface")) +
  labs(title = "Learning Approaches by Year (R-SPQ-2F)", x = "Year", y = "Score (1-5)", fill = "Approach") +
  theme_minimal()` },
        { labId: spqLab.id, title: 'Approaches & Achievement', description: 'Examine how learning approaches predict GPA', orderIndex: 2, code: `library(ggplot2)

cat("=== Correlations with GPA ===\\n")
cat(sprintf("Deep  <-> GPA: r = %+.3f\\n", cor(spq$deep_approach, spq$gpa)))
cat(sprintf("Surface <-> GPA: r = %+.3f\\n", cor(spq$surface_approach, spq$gpa)))

cat("\\n=== Regression: Approaches -> GPA ===\\n")
model <- lm(gpa ~ deep_approach + surface_approach, data = spq)
summary(model)

ggplot(spq, aes(x = deep_approach, y = gpa, color = surface_approach)) +
  geom_point(size = 3, alpha = 0.7) +
  geom_smooth(method = "lm", se = TRUE, color = "#2c3e50") +
  scale_color_gradient(low = "#27ae60", high = "#e74c3c", name = "Surface\\nApproach") +
  labs(title = "Deep Approach vs GPA (colored by Surface Approach)",
       subtitle = "R-SPQ-2F (Biggs et al., 2001)", x = "Deep Approach", y = "GPA") +
  theme_minimal()` },
      ],
    });
  }

  // =========================================================================
  // SNA Lab (Social Network Analysis with igraph)
  // =========================================================================
  const snaLab = await prisma.customLab.findFirst({ where: { name: 'SNA Lab', labType: 'sna' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'SNA Lab',
        description: 'Social Network Analysis with igraph — centrality, communities, resilience, and more',
        labType: 'sna',
        isPublic: true,
        createdBy: admin.id,
      },
    });
  const existingSnaTemplates = await prisma.labTemplate.count({ where: { labId: snaLab.id } });
  if (existingSnaTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [
        { labId: snaLab.id, title: '1. Build a Network from an Edge List', description: 'Create an igraph network from an edge list and visualize it', orderIndex: 0, code: `library(igraph)

# Create a directed, weighted network from an edge list
edges <- data.frame(
  from   = c("Alice","Alice","Bob","Bob","Charlie","Diana","Diana","Eve","Eve","Frank",
             "Grace","Grace","Hannah","Ivan","Ivan","Julia","Julia","Karl","Laura","Laura"),
  to     = c("Bob","Charlie","Charlie","Diana","Alice","Eve","Frank","Frank","Grace","Grace",
             "Hannah","Ivan","Ivan","Julia","Karl","Karl","Laura","Alice","Bob","Diana"),
  weight = c(3, 2, 5, 1, 2, 4, 3, 2, 5, 1, 3, 2, 4, 1, 3, 2, 5, 1, 3, 2)
)

g <- graph_from_data_frame(edges, directed = TRUE)
cat("Network created:\\n")
cat("  Nodes:", vcount(g), "\\n")
cat("  Edges:", ecount(g), "\\n")
cat("  Directed:", is_directed(g), "\\n\\n")

plot_network(g, layout = "circle", main = "Circle Layout")
plot_network(g, layout = "fr", main = "Force-Directed Layout")` },
        { labId: snaLab.id, title: '2. Network Descriptive Statistics', description: 'Compute density, diameter, transitivity, reciprocity, and more', orderIndex: 1, code: `library(igraph)

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

cat("=== NETWORK DESCRIPTIVE STATISTICS ===\\n\\n")
cat("Nodes:", vcount(g), "  Edges:", ecount(g), "\\n")
cat("Density:", round(edge_density(g), 4), "\\n")
cat("Diameter:", diameter(g, directed = TRUE), "\\n")
cat("Avg Path Length:", round(mean_distance(g, directed = TRUE), 3), "\\n")
cat("Transitivity:", round(transitivity(g, type = "global"), 4), "\\n")
cat("Reciprocity:", round(reciprocity(g), 4), "\\n")

plot_network(g, layout = "fr", main = "Classroom Friendship Network")` },
        { labId: snaLab.id, title: '3. Centrality Analysis', description: 'Calculate and compare 7 centrality measures', orderIndex: 2, code: `library(igraph)

set.seed(42)
edges <- data.frame(
  from   = c("Amy","Amy","Ben","Ben","Cat","Cat","Dan","Dan","Eve","Eve",
             "Fay","Fay","Guy","Guy","Hal","Ivy","Ivy","Jay","Jay","Kim"),
  to     = c("Ben","Cat","Cat","Dan","Dan","Eve","Eve","Fay","Fay","Guy",
             "Guy","Hal","Hal","Ivy","Ivy","Jay","Kim","Kim","Amy","Amy"),
  weight = c(5,3,4,2,3,5,2,4,3,2,5,1,3,4,2,3,5,2,4,3)
)
g <- graph_from_data_frame(edges, directed = TRUE)

# Compute centralities
cent <- data.frame(
  node         = V(g)$name,
  in_degree    = degree(g, mode = "in"),
  out_degree   = degree(g, mode = "out"),
  betweenness  = round(betweenness(g, directed = TRUE), 2),
  closeness_in = round(closeness(g, mode = "in"), 4),
  eigenvector  = round(eigen_centrality(g, directed = TRUE)$vector, 4),
  pagerank     = round(page_rank(g)$vector, 4)
)
print(cent[order(-cent$betweenness), ])

plot_centrality(g, measures = c("in_degree","out_degree","betweenness","pagerank"), main = "Centrality Comparison")
plot_network(g, layout = "fr", main = "Network (node size = betweenness)", vertex.size = 8 + betweenness(g, directed = TRUE) * 2)` },
        { labId: snaLab.id, title: '4. Community Detection', description: 'Detect and visualize communities using multiple algorithms', orderIndex: 3, code: `library(igraph)

set.seed(42)
g <- sample_sbm(30, pref.matrix = matrix(c(0.5, 0.05, 0.02,
                                            0.05, 0.4, 0.03,
                                            0.02, 0.03, 0.45), 3, 3),
                block.sizes = c(10, 10, 10))
V(g)$name <- paste0("N", 1:30)

# Try multiple algorithms
plot_communities(g, algorithm = "louvain", layout = "fr", main = "Louvain Communities")
plot_communities(g, algorithm = "walktrap", layout = "fr", main = "Walktrap Communities")
plot_communities(g, algorithm = "label_prop", layout = "fr", main = "Label Propagation")` },
        { labId: snaLab.id, title: '5. Network Resilience', description: 'Simulate targeted attacks vs random failures', orderIndex: 4, code: `library(igraph)

set.seed(42)
g <- sample_pa(40, m = 2, directed = FALSE)
V(g)$name <- paste0("N", 1:40)

cat("Original network:", vcount(g), "nodes,", ecount(g), "edges\\n")
cat("Connected:", is_connected(g), "\\n\\n")

# Targeted attack (remove highest-degree nodes)
g_attack <- g
removed <- 0
for (i in 1:10) {
  d <- degree(g_attack)
  target <- which.max(d)
  g_attack <- delete_vertices(g_attack, target)
  removed <- removed + 1
  comps <- components(g_attack)
  cat(sprintf("Removed %2d (targeted): %d nodes left, %d components, largest = %d\\n",
      removed, vcount(g_attack), comps$no, max(comps$csize)))
}

cat("\\n--- Random failure ---\\n")
g_random <- g
for (i in 1:10) {
  target <- sample(vcount(g_random), 1)
  g_random <- delete_vertices(g_random, target)
  comps <- components(g_random)
  cat(sprintf("Removed %2d (random):   %d nodes left, %d components, largest = %d\\n",
      i, vcount(g_random), comps$no, max(comps$csize)))
}

plot_network(g, layout = "fr", main = "Original Scale-Free Network")` },
        { labId: snaLab.id, title: '6. Complete SNA Pipeline', description: 'End-to-end analysis of a classroom network', orderIndex: 5, code: `library(igraph)

# Classroom collaboration network
set.seed(123)
students <- paste0("S", sprintf("%02d", 1:20))
n_edges <- 45
from <- sample(students, n_edges, replace = TRUE)
to <- sample(students, n_edges, replace = TRUE)
valid <- from != to
edges <- data.frame(from = from[valid], to = to[valid], weight = sample(1:5, sum(valid), replace = TRUE))
g <- graph_from_data_frame(edges, directed = TRUE, vertices = data.frame(name = students))
g <- simplify(g, edge.attr.comb = list(weight = "max"))

cat("=== CLASSROOM COLLABORATION NETWORK ===\\n")
cat("Students:", vcount(g), "  Connections:", ecount(g), "\\n")
cat("Density:", round(edge_density(g), 3), "\\n")
cat("Reciprocity:", round(reciprocity(g), 3), "\\n\\n")

# Key players
pr <- page_rank(g)$vector
bt <- betweenness(g, directed = TRUE)
cat("Top 5 by PageRank:\\n")
print(sort(pr, decreasing = TRUE)[1:5])
cat("\\nTop 5 by Betweenness:\\n")
print(sort(bt, decreasing = TRUE)[1:5])

plot_network(g, layout = "fr", main = "Classroom Collaboration Network", vertex.size = 5 + pr * 80)
plot_centrality(g, measures = c("in_degree","out_degree","betweenness","pagerank"), main = "Student Centralities")
plot_communities(g, algorithm = "louvain", layout = "fr", main = "Student Groups (Louvain)")` },
      ],
    });
  }

  // =========================================================================
  // Python Data Science Lab
  // =========================================================================
  const pythonLab = await prisma.customLab.findFirst({ where: { name: 'Python Data Science Lab', labType: 'python-data' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'Python Data Science Lab',
        description: 'Data analysis, visualization, and machine learning with Python — NumPy, Pandas, Matplotlib, and scikit-learn',
        labType: 'python-data',
        isPublic: true,
        createdBy: admin.id,
      },
    });
  const existingPythonTemplates = await prisma.labTemplate.count({ where: { labId: pythonLab.id } });
  if (existingPythonTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [
        { labId: pythonLab.id, title: '1. NumPy Fundamentals', description: 'Array creation, operations, and linear algebra', orderIndex: 0, code: `import numpy as np

# Create arrays
a = np.array([1, 2, 3, 4, 5])
b = np.linspace(0, 10, 6)
mat = np.random.randn(4, 4)

print("Array a:", a)
print("Linspace b:", b)
print("\\nRandom matrix:")
print(np.round(mat, 3))
print("\\nMean:", np.mean(mat))
print("Std:", np.round(np.std(mat), 4))
print("Eigenvalues:", np.round(np.linalg.eigvals(mat), 3))` },
        { labId: pythonLab.id, title: '2. Pandas Data Exploration', description: 'Load, inspect, and summarize data', orderIndex: 1, code: `import pandas as pd
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
print("\\nDescriptives:")
print(df.describe().round(2))
print("\\nCorrelations:")
print(df[['math_score', 'reading_score', 'study_hours']].corr().round(3))` },
        { labId: pythonLab.id, title: '3. Matplotlib Visualizations', description: 'Scatter plots, histograms, and multi-panel figures', orderIndex: 2, code: `import matplotlib.pyplot as plt
import numpy as np

np.random.seed(42)
x = np.random.normal(0, 1, 200)
y = 0.8 * x + np.random.normal(0, 0.5, 200)

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].scatter(x, y, alpha=0.5, c='#3498db', s=30)
axes[0].set_title('Scatter Plot')
axes[0].set_xlabel('X')
axes[0].set_ylabel('Y')

axes[1].hist(x, bins=25, color='#e74c3c', alpha=0.7, edgecolor='white')
axes[1].set_title('Distribution of X')
axes[1].set_xlabel('Value')

plt.tight_layout()
plt.show()` },
        { labId: pythonLab.id, title: '4. Statistical Testing', description: 'T-tests, chi-squared, and correlation', orderIndex: 3, code: `import numpy as np
from scipy import stats

np.random.seed(42)
group_a = np.random.normal(75, 10, 30)
group_b = np.random.normal(80, 12, 30)

t_stat, p_value = stats.ttest_ind(group_a, group_b)
print("=== Independent Samples T-Test ===")
print(f"Group A: M = {group_a.mean():.2f}, SD = {group_a.std():.2f}")
print(f"Group B: M = {group_b.mean():.2f}, SD = {group_b.std():.2f}")
print(f"t = {t_stat:.3f}, p = {p_value:.4f}")

r, p = stats.pearsonr(group_a, group_b[:30])
print(f"\\n=== Pearson Correlation ===")
print(f"r = {r:.3f}, p = {p:.4f}")` },
        { labId: pythonLab.id, title: '5. ML Classification Pipeline', description: 'Train, evaluate, and compare classifiers', orderIndex: 4, code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report

X, y = make_classification(n_samples=200, n_features=5, n_informative=3, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

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

plt.barh(list(results.keys()), list(results.values()), color=['#3498db', '#2ecc71'])
plt.xlim(0, 1)
plt.xlabel('Accuracy')
plt.title('Model Comparison')
plt.tight_layout()
plt.show()` },
      ],
    });
  }

  // =========================================================================
  // Python SNA Lab
  // =========================================================================
  const pythonSnaLab = await prisma.customLab.findFirst({ where: { name: 'Python SNA Lab', labType: 'python-sna' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'Python SNA Lab',
        description: 'Social Network Analysis with NetworkX — centrality, communities, resilience, ego networks, and more',
        labType: 'python-sna',
        isPublic: true,
        createdBy: admin.id,
      },
    });
  const existingPySnaTemplates = await prisma.labTemplate.count({ where: { labId: pythonSnaLab.id } });
  if (existingPySnaTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [
        { labId: pythonSnaLab.id, title: '1. Build a Network', description: 'Create a directed weighted network with NetworkX', orderIndex: 0, code: `import networkx as nx
import matplotlib.pyplot as plt

edges = [
    ("Alice","Bob",3), ("Alice","Charlie",2), ("Bob","Charlie",5),
    ("Bob","Diana",1), ("Charlie","Alice",2), ("Diana","Eve",4),
    ("Diana","Frank",3), ("Eve","Frank",2), ("Eve","Grace",5),
    ("Frank","Grace",1), ("Grace","Hannah",3), ("Hannah","Ivan",4),
]
G = nx.DiGraph()
for u, v, w in edges:
    G.add_edge(u, v, weight=w)

print(f"Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}")

pos = nx.spring_layout(G, seed=42)
nx.draw(G, pos, with_labels=True, node_color='#5ab4ac',
        node_size=600, font_size=9, arrows=True, arrowsize=15,
        edge_color='gray', font_weight='bold')
plt.title("Collaboration Network")
plt.show()` },
        { labId: pythonSnaLab.id, title: '2. Centrality Analysis', description: 'Compare PageRank, betweenness, and degree centrality', orderIndex: 1, code: `import networkx as nx
import matplotlib.pyplot as plt
import numpy as np

edges = [
    ("Amy","Ben",5), ("Amy","Cat",3), ("Ben","Cat",4), ("Ben","Dan",2),
    ("Cat","Dan",3), ("Cat","Eve",5), ("Dan","Eve",2), ("Dan","Fay",4),
    ("Eve","Fay",3), ("Eve","Guy",2), ("Fay","Guy",5), ("Guy","Ivy",4),
    ("Ivy","Jay",3), ("Jay","Amy",4),
]
G = nx.DiGraph()
for u, v, w in edges:
    G.add_edge(u, v, weight=w)

pr = nx.pagerank(G)
bt = nx.betweenness_centrality(G)

print(f"{'Node':>6} {'PageRank':>10} {'Betweenness':>12}")
for n in sorted(G.nodes()):
    print(f"{n:>6} {pr[n]:>10.4f} {bt[n]:>12.4f}")

fig, ax = plt.subplots(figsize=(10, 5))
nodes = sorted(G.nodes())
x = np.arange(len(nodes))
ax.bar(x - 0.15, [pr[n] for n in nodes], 0.3, label='PageRank', color='#3498db')
ax.bar(x + 0.15, [bt[n] for n in nodes], 0.3, label='Betweenness', color='#e74c3c')
ax.set_xticks(x)
ax.set_xticklabels(nodes, rotation=45)
ax.legend()
ax.set_title("Centrality Comparison")
plt.tight_layout()
plt.show()` },
        { labId: pythonSnaLab.id, title: '3. Community Detection', description: 'Detect communities with Louvain algorithm', orderIndex: 2, code: `import networkx as nx
import matplotlib.pyplot as plt
from networkx.algorithms.community import louvain_communities

sizes = [10, 10, 10]
probs = [[0.5, 0.05, 0.02], [0.05, 0.4, 0.03], [0.02, 0.03, 0.45]]
G = nx.stochastic_block_model(sizes, probs, seed=42)

communities = louvain_communities(G, seed=42)
palette = ['#5ab4ac','#e6ab02','#a985ca','#e15759','#5a9bd4']
color_map = {}
for i, comm in enumerate(communities):
    for node in comm:
        color_map[node] = palette[i % len(palette)]

pos = nx.spring_layout(G, seed=42)
colors = [color_map[n] for n in G.nodes()]
nx.draw(G, pos, with_labels=True, node_color=colors, node_size=400,
        font_size=7, edge_color='gray', width=0.5)
plt.title(f"Louvain Communities ({len(communities)} groups)")
plt.show()

for i, comm in enumerate(communities):
    print(f"Community {i+1} ({len(comm)} nodes): {sorted(comm)}")` },
      ],
    });
  }

  === End commented out labs */

  // =========================================================================
  // Karate Club — igraph Layouts Lab
  // =========================================================================
  const karateLayoutsLab = await prisma.customLab.findFirst({ where: { name: 'Karate Club: igraph Layouts', labType: 'sna' } })
    ?? await prisma.customLab.create({
      data: {
        name: 'Karate Club: igraph Layouts',
        description: "Zachary's Karate Club network — explore every layout algorithm in igraph. Each template applies one layout and explains when and why to use it.",
        labType: 'sna',
        isPublic: true,
        createdBy: admin.id,
      },
    });

  const existingKarateTemplates = await prisma.labTemplate.count({ where: { labId: karateLayoutsLab.id } });
  if (existingKarateTemplates === 0) {
    await prisma.labTemplate.createMany({
      data: [

        // ------------------------------------------------------------------
        // 1. The Story
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 0,
          title: '1. The Karate Club Story',
          description: 'History of Zachary\'s study, network overview, and a first look at the data',
          code: `library(igraph)

# ============================================================
# Zachary's Karate Club — The Story
# ============================================================
# In 1970, sociologist Wayne W. Zachary spent three years
# observing a university karate club. He recorded 78 pairwise
# interactions between 34 members outside of class time —
# things like shared meals, visits, and social events.
#
# In 1977, a conflict erupted between the club administrator,
# known as "Mr. Hi" (node 1), and the club president, called
# "Officer John A." (node 34). The dispute was over whether
# the instructor (Mr. Hi) had the right to raise lesson fees.
# The club eventually split into two groups, each rallying
# around one of the two leaders.
#
# Using only his network data — collected before the split —
# Zachary was able to predict which faction each member would
# join. He was correct for every member except one.
#
# The dataset became a cornerstone benchmark in community
# detection research. Every major algorithm is tested on it
# because the ground truth (who joined which side) is known.
#
# Reference:
#   Zachary, W.W. (1977). An information flow model for
#   conflict and fission in small groups. Journal of
#   Anthropological Research, 33(4), 452-473.
# ============================================================

g <- make_graph("Zachary")

cat("=== Network Overview ===\\n")
cat("Members (nodes)  :", vcount(g), "\\n")
cat("Interactions (edges):", ecount(g), "\\n")
cat("Density          :", round(edge_density(g), 3), "\\n")
cat("Avg. path length :", round(mean_distance(g), 3), "\\n")
cat("Clustering coeff :", round(transitivity(g), 3), "\\n")
cat("Diameter         :", diameter(g), "\\n")
cat("Is connected     :", is_connected(g), "\\n\\n")

# Faction membership (Zachary, 1977)
# 1 = Mr. Hi's group, 2 = Officer John A.'s group
cat("Top 5 nodes by degree:\\n")
deg <- sort(degree(g), decreasing = TRUE)
print(deg[1:5])

set.seed(42)
plot(g)`,
        },

        // ------------------------------------------------------------------
        // 2. Random Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 1,
          title: '2. Random Layout',
          description: 'layout_randomly — the baseline: no structure, pure randomness',
          code: `library(igraph)

# ============================================================
# Layout: Random  (layout_randomly)
# ============================================================
# Each node is placed at a uniformly random position on the
# unit square. No optimisation is applied — positions are
# independent of the edges.
#
# WHY DOES IT EXIST?
#   Random placement is the starting point for most
#   force-directed algorithms. Many of them initialise nodes
#   randomly and then iterate until a stable arrangement is
#   found. By itself, the random layout is rarely used in
#   final visualisations — it exists as a baseline.
#
# STRENGTHS:
#   - Extremely fast (no computation at all).
#   - Useful for benchmarking: any layout that looks worse
#     than random has a bug.
#
# WEAKNESSES:
#   - Conveys no structural information.
#   - Changes completely with every run (not reproducible
#     unless you fix the random seed).
#
# WHAT TO NOTICE:
#   The two factions (blue vs red) are completely mixed —
#   you cannot tell them apart. This is what a layout looks
#   like before any optimisation has been done.
#   Try removing set.seed(42) and running again to see how
#   different each random draw looks.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_randomly(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 3. Circle Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 2,
          title: '3. Circle Layout',
          description: 'layout_in_circle — all nodes evenly spaced on a ring',
          code: `library(igraph)

# ============================================================
# Layout: Circle  (layout_in_circle)
# ============================================================
# All nodes are placed equidistantly on a single circle,
# ordered by their vertex index (1 to 34). It is one of the
# oldest and most widely recognised network layouts.
#
# STRENGTHS:
#   - Completely deterministic and reproducible with no
#     random seed needed.
#   - Labels never overlap because every node has equal
#     angular spacing.
#   - Makes it easy to identify long-range edges (they cross
#     the interior) versus short-range edges (they hug the rim).
#   - Great for comparing two circular orderings side-by-side.
#
# WEAKNESSES:
#   - Community structure is invisible unless nodes are
#     manually sorted by group before plotting.
#   - Dense graphs create a dense web of crossing chords
#     in the interior, which is hard to read.
#   - Most of the canvas is empty.
#
# WHAT TO NOTICE:
#   Nodes 1-8 (blue) are clustered at the top, and the red
#   nodes dominate the lower arc. This is an artefact of how
#   Zachary numbered the members, not of the layout itself.
#   Notice the long chords connecting Mr. Hi (1) and the
#   Officer (34) to members throughout the network.
# ============================================================

g <- make_graph("Zachary")

lay <- layout_in_circle(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 4. Star Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 3,
          title: '4. Star Layout',
          description: 'layout_as_star — one node at the centre, all others on the rim',
          code: `library(igraph)

# ============================================================
# Layout: Star  (layout_as_star)
# ============================================================
# One node is placed at the centre of the canvas and all
# remaining nodes are arranged on a circle around it.
# By default igraph places vertex 1 at the centre — here
# that is Mr. Hi, the most central actor in the network.
#
# STRENGTHS:
#   - Immediately highlights the ego network of the centre
#     node: you can see which nodes it connects to directly
#     (first ring) and which are further away.
#   - Very clean for hub-and-spoke or hierarchical structures
#     where one node genuinely dominates.
#
# WEAKNESSES:
#   - Edges between peripheral nodes all run along the rim
#     and are hard to see.
#   - Misleads the viewer into thinking the centre node is
#     the most important — which may or may not be true.
#   - Poor choice for networks without a clear central hub.
#
# WHAT TO NOTICE:
#   Mr. Hi (node 1, dark blue) sits at the centre. You can
#   immediately count his 16 direct connections. The Officer
#   (node 34, dark red) is on the rim — notice that he is
#   connected to many red nodes that are NOT connected to
#   Mr. Hi, revealing the fault line that caused the split.
# ============================================================

g <- make_graph("Zachary")

# centre = vertex 1 (Mr. Hi)
lay <- layout_as_star(g, center = 1)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 5. Grid Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 4,
          title: '5. Grid Layout',
          description: 'layout_on_grid — nodes arranged in a rectangular grid',
          code: `library(igraph)

# ============================================================
# Layout: Grid  (layout_on_grid)
# ============================================================
# Nodes are placed on a regular rectangular grid. igraph
# fills the grid row-by-row in vertex index order. For 34
# nodes the grid is approximately 6 x 6 with some empty
# cells in the last row.
#
# STRENGTHS:
#   - Perfectly uniform spacing — no node is visually more
#     prominent than another due to position alone.
#   - Useful when you want to compare attribute values
#     across nodes without being distracted by topology
#     (e.g., colour coding all nodes by a score).
#   - Reproducible and deterministic.
#
# WEAKNESSES:
#   - Ignores the graph structure entirely. Connected nodes
#     are not placed near each other.
#   - Edges look like a random tangle.
#   - Rarely used for network topology analysis.
#
# WHEN TO USE IT:
#   Grid layouts are popular in genomics and bioinformatics
#   where the positions carry a meaningful meaning (e.g.,
#   chromosomal position), not for social networks.
#
# WHAT TO NOTICE:
#   Because nodes are ordered 1-34, blue nodes cluster in
#   the upper rows and red nodes in the lower rows —
#   again an artefact of numbering, not of structure.
# ============================================================

g <- make_graph("Zachary")

lay <- layout_on_grid(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 6. Sphere Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 5,
          title: '6. Sphere Layout',
          description: 'layout_on_sphere — nodes distributed on a 3D sphere, projected to 2D',
          code: `library(igraph)

# ============================================================
# Layout: Sphere  (layout_on_sphere)
# ============================================================
# Nodes are placed on the surface of a unit sphere in 3D
# space using a spiral algorithm, then projected onto a 2D
# plane using a perspective projection. The result looks
# like points on a globe.
#
# STRENGTHS:
#   - Provides more uniform spacing than a flat circle,
#     because the sphere surface is used more efficiently.
#   - Nodes near the "equator" are spread out; the "poles"
#     are denser — this mimics geographic map projections.
#   - Visually interesting and novel.
#
# WEAKNESSES:
#   - The 2D projection distorts distances: nodes at the
#     edges of the visible hemisphere appear closer than
#     they really are on the sphere.
#   - Does not encode any graph structure.
#   - Only the front hemisphere is visible in 2D projection.
#
# WHAT TO NOTICE:
#   Compare this with the Circle layout (template 3). The
#   sphere layout distributes nodes more evenly across the
#   canvas rather than cramming them all to the edge. Still,
#   like the circle, it encodes no graph structure.
# ============================================================

g <- make_graph("Zachary")

lay <- layout_on_sphere(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 7. Fruchterman-Reingold
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 6,
          title: '7. Fruchterman-Reingold',
          description: 'layout_with_fr — the most popular force-directed layout',
          code: `library(igraph)

# ============================================================
# Layout: Fruchterman-Reingold  (layout_with_fr)
# ============================================================
# Published by Thomas Fruchterman and Edward Reingold in 1991,
# this is the single most widely used network layout algorithm.
# It models the graph as a physical system: nodes repel each
# other like charged particles while edges attract connected
# nodes like springs.
#
# HOW IT WORKS:
#   1. Initialise nodes at random positions.
#   2. In each iteration, calculate repulsive forces between
#      ALL pairs of nodes and attractive forces along edges.
#   3. Move each node in the direction of its net force.
#   4. Gradually reduce a "temperature" parameter that limits
#      how far nodes can move per iteration (like simulated
#      annealing) until the layout stabilises.
#
# STRENGTHS:
#   - Clusters connected nodes together organically.
#   - The two karate factions will visually separate even
#     though the algorithm has no knowledge of factions.
#   - Good balance of readability and computation time.
#   - niter parameter lets you trade quality for speed.
#
# WEAKNESSES:
#   - Results differ slightly across runs (random init).
#     Use set.seed() for reproducibility.
#   - O(n^2) per iteration; slow for very large graphs.
#   - May have local optima — different seeds give different
#     (but equally valid) layouts.
#
# WHAT TO NOTICE:
#   The two factions separate into clear clusters! This is
#   the emergent property that made this dataset famous.
#   Mr. Hi (1) and the Officer (34) sit on opposite sides,
#   surrounded by their respective groups.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_fr(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 8. Kamada-Kawai
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 7,
          title: '8. Kamada-Kawai',
          description: 'layout_with_kk — stress minimisation based on graph distances',
          code: `library(igraph)

# ============================================================
# Layout: Kamada-Kawai  (layout_with_kk)
# ============================================================
# Proposed by Tomihisa Kamada and Satoru Kawai in 1989, this
# layout minimises the difference between the geometric
# distance between two nodes on screen and their theoretical
# ideal distance (derived from their shortest-path length
# in the graph).
#
# HOW IT WORKS:
#   Each pair of nodes has an "ideal distance" proportional
#   to their graph distance (number of hops). The algorithm
#   minimises the total stress — the sum of squared
#   differences between actual Euclidean distances and
#   ideal distances across all pairs.
#
# STRENGTHS:
#   - Preserves graph distances more faithfully than FR.
#   - Nodes 1 hop apart will be visually closer than nodes
#     3 hops apart, making path lengths readable.
#   - Usually produces very aesthetically pleasing layouts.
#   - Good for medium-sized graphs (under ~500 nodes).
#
# WEAKNESSES:
#   - O(n^2) in memory for the distance matrix.
#   - Slower than FR for large graphs.
#   - Can struggle with disconnected graphs.
#
# WHAT TO NOTICE:
#   Compare to Fruchterman-Reingold (template 7). KK tends
#   to produce rounder, more symmetric arrangements. The
#   faction split is still clearly visible, but the two
#   "bridge" nodes — those connected to both factions —
#   are placed right in the middle between the two groups.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_kk(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 9. GEM Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 8,
          title: '9. GEM Layout',
          description: 'layout_with_gem — force-directed with temperature and momentum',
          code: `library(igraph)

# ============================================================
# Layout: GEM  (layout_with_gem)
# ============================================================
# GEM stands for Graph EMbedder, developed by Arne Frick,
# Andreas Ludwig, and Heiko Mehldau in 1994. Like FR, it is
# a force-directed algorithm, but it refines the cooling
# schedule with per-node "temperatures" and adds a local
# gravity force to prevent the graph from flying apart.
#
# HOW IT WORKS:
#   Each node has its own temperature (maximum move step).
#   - If a node oscillates (keeps reversing direction), its
#     temperature drops — it slows down and settles.
#   - If a node moves consistently in one direction, its
#     temperature rises — it accelerates toward equilibrium.
#   A global gravity force pulls all nodes toward the centre
#   of the canvas, preventing unbounded drift.
#
# STRENGTHS:
#   - The per-node temperature adapts to local topology,
#     often producing better results than FR on irregular
#     or hierarchical graphs.
#   - The gravity force makes it robust to disconnected
#     components drifting away.
#   - Typically converges faster than KK on medium graphs.
#
# WEAKNESSES:
#   - More sensitive to parameter tuning than FR.
#   - Less commonly used and documented.
#
# WHAT TO NOTICE:
#   GEM often produces a slightly more spread-out layout
#   than FR, with clearer separation between peripheral
#   nodes. The faction boundary may look slightly different
#   from FR — compare the two side by side.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_gem(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 10. GraphOpt
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 9,
          title: '10. GraphOpt Layout',
          description: 'layout_with_graphopt — spring-electrical model with charge and spring constants',
          code: `library(igraph)

# ============================================================
# Layout: GraphOpt  (layout_with_graphopt)
# ============================================================
# Developed by Michael Schmuhl, GraphOpt models the graph
# as a physical system similar to FR but with a richer
# force model. Nodes act as charged particles (repel each
# other) AND as masses connected by springs (attract along
# edges). Both the charge and spring constants are
# user-tunable.
#
# HOW IT WORKS:
#   Net force on each node = spring attraction (connected
#   nodes only) + electrostatic repulsion (all node pairs).
#   The ratio of the charge to the spring constant controls
#   how "tight" vs "spread out" the layout is. A high
#   charge makes nodes spread apart; a high spring constant
#   pulls connected nodes close together.
#
# KEY PARAMETERS (tunable in igraph):
#   niter        — number of iterations (default 500)
#   charge       — repulsion strength (default 0.001)
#   spring.const — spring strength (default 1)
#   spring.length— ideal edge length (default 0)
#
# STRENGTHS:
#   - High degree of control through parameters.
#   - Can produce very clean layouts on sparse graphs.
#
# WEAKNESSES:
#   - Requires manual tuning for best results.
#   - Results are sensitive to parameter choice.
#
# WHAT TO NOTICE:
#   With default parameters on the karate graph, GraphOpt
#   often produces a more compact layout than FR. The
#   high-degree hubs (Mr. Hi, Officer) pull their
#   neighbours in tightly, making the faction structure
#   visible but in a denser form.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_graphopt(g, niter = 1000, charge = 0.005)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 11. Davidson-Harel
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 10,
          title: '11. Davidson-Harel',
          description: 'layout_with_dh — simulated annealing for aesthetic optimisation',
          code: `library(igraph)

# ============================================================
# Layout: Davidson-Harel  (layout_with_dh)
# ============================================================
# Proposed by Ron Davidson and David Harel in 1996, this
# algorithm uses simulated annealing to optimise a set of
# aesthetic criteria simultaneously rather than just
# minimising a single energy function.
#
# HOW IT WORKS:
#   The objective function combines MULTIPLE aesthetics:
#     1. Uniform node distribution (nodes spread evenly).
#     2. Short edges (connected nodes close together).
#     3. Few edge crossings (edges avoid intersecting).
#     4. Nodes not too close to edges (visual clarity).
#     5. Nodes near the centre of the canvas.
#
#   Simulated annealing allows the algorithm to accept
#   temporarily worse layouts to escape local optima,
#   then gradually cools down to find a global optimum.
#
# STRENGTHS:
#   - Multi-criteria optimisation often produces very
#     aesthetically clean layouts.
#   - Better at minimising edge crossings than FR or KK.
#   - Excellent for paper figures and presentations.
#
# WEAKNESSES:
#   - Slow: O(n^2) per iteration, many iterations needed.
#   - Can be very slow on graphs with more than ~100 nodes.
#
# WHAT TO NOTICE:
#   Davidson-Harel tends to produce more "orderly" layouts
#   with fewer edge crossings than FR. Notice how the
#   peripheral low-degree nodes are cleanly placed on the
#   outside, with the high-degree hubs more central.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_dh(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 12. Large Graph Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 11,
          title: '12. Large Graph Layout (LGL)',
          description: 'layout_with_lgl — designed for graphs with thousands of nodes',
          code: `library(igraph)

# ============================================================
# Layout: Large Graph Layout  (layout_with_lgl)
# ============================================================
# Developed by Alex Adai and Edward Marcotte at UT Austin,
# LGL was designed to visualise very large graphs (tens of
# thousands of nodes) that would be too slow for FR or KK.
#
# HOW IT WORKS:
#   1. Find a "root" node (usually the most central or
#      highest degree node).
#   2. Build concentric shells around the root using BFS.
#   3. Place nodes in each shell on a circle, scaling the
#      radius by the shell distance from the root.
#   4. Apply a short local force-directed pass within each
#      shell to spread nodes and reduce overlap.
#
#   Because force calculations are done only within local
#   shells (not across all pairs), the algorithm scales
#   to O(n log n) rather than O(n^2).
#
# STRENGTHS:
#   - Handles graphs with 10,000+ nodes comfortably.
#   - Reveals hierarchical "star" structure around hubs.
#   - Very fast.
#
# WEAKNESSES:
#   - Designed for sparse scale-free networks; can look
#     odd on dense or regular graphs.
#   - The result depends heavily on which node is chosen
#     as root.
#   - For small graphs like the karate club, FR or KK
#     will usually look better.
#
# WHAT TO NOTICE:
#   LGL places the highest-degree node (Mr. Hi or the
#   Officer, depending on the run) at the centre with
#   concentric rings. This gives a "galaxy" appearance
#   quite different from the other force-directed layouts.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_lgl(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 13. MDS Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 12,
          title: '13. MDS Layout',
          description: 'layout_with_mds — multidimensional scaling preserves graph distances',
          code: `library(igraph)

# ============================================================
# Layout: Multidimensional Scaling  (layout_with_mds)
# ============================================================
# MDS is a classical statistical technique that maps high-
# dimensional distance data into a low-dimensional space
# (here 2D) while preserving pairwise distances as faithfully
# as possible.
#
# HOW IT WORKS:
#   1. Compute the all-pairs shortest-path distance matrix
#      D for the graph.
#   2. Apply classical MDS (Torgerson 1952) to find a 2D
#      embedding where Euclidean distances match D as
#      closely as possible.
#   3. Solve the eigenvalue problem of the centred inner-
#      product matrix; the top 2 eigenvectors give the
#      x and y coordinates.
#
# STRENGTHS:
#   - Distance is the only criterion: nodes 1 hop apart
#     are guaranteed to be closer on screen than nodes
#     3 hops apart (approximately).
#   - Unique mathematical solution (no random component).
#   - Excellent for exploring network distance structure.
#
# WEAKNESSES:
#   - Can produce elongated "sausage" shaped layouts if
#     the graph has a linear backbone.
#   - O(n^2) memory for the distance matrix.
#   - Distances in the plane are approximate — exact
#     preservation is impossible in 2D for most graphs.
#
# WHAT TO NOTICE:
#   The layout is the most "distance-honest" of all. The
#   gap between the two factions directly reflects the
#   fact that cross-faction paths are longer than within-
#   faction paths. This is why Zachary could predict
#   the split: the network distance predicted allegiance.
# ============================================================

g <- make_graph("Zachary")

lay <- layout_with_mds(g)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 14. Tree Layout (Reingold-Tilford)
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 13,
          title: '14. Tree Layout (Reingold-Tilford)',
          description: 'layout_as_tree — hierarchical top-down tree, rooted at Mr. Hi',
          code: `library(igraph)

# ============================================================
# Layout: Reingold-Tilford Tree  (layout_as_tree)
# ============================================================
# Introduced by Edward Reingold and John Tilford in 1981,
# this layout was designed for rooted trees. igraph extends
# it to general graphs by first computing a spanning tree
# from the chosen root, then applying the tree layout to
# that spanning tree.
#
# HOW IT WORKS:
#   1. Choose a root node (here: node 1, Mr. Hi).
#   2. Compute a BFS spanning tree rooted at that node.
#   3. Place the root at the top level.
#   4. Place each child one level below its parent.
#   5. Spread siblings horizontally to avoid overlap using
#      the Reingold-Tilford algorithm (which minimises
#      total width while keeping siblings symmetrically
#      arranged around their parent).
#
# STRENGTHS:
#   - Very readable for trees and near-tree structures.
#   - Clearly shows hierarchy and depth from the root.
#   - Siblings at the same depth are aligned horizontally,
#     making comparison easy.
#
# WEAKNESSES:
#   - The karate club is NOT a tree (it has many cycles),
#     so the layout only shows the BFS spanning tree.
#     Many edges are "hidden" in the hierarchy — they are
#     drawn as crossing lines that look messy.
#   - The result depends heavily on which root you choose.
#
# WHAT TO NOTICE:
#   Mr. Hi (1) sits at the top. The nodes in his faction
#   tend to appear at shallow depths (close to him), while
#   the Officer's faction appears deeper or in separate
#   branches — a visual representation of social distance.
# ============================================================

g <- make_graph("Zachary")

# Root at Mr. Hi (vertex 1)
lay <- layout_as_tree(g, root = 1)
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 15. Sugiyama Layout
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 14,
          title: '15. Sugiyama Layout',
          description: 'layout_with_sugiyama — hierarchical layered layout minimising edge crossings',
          code: `library(igraph)

# ============================================================
# Layout: Sugiyama  (layout_with_sugiyama)
# ============================================================
# Proposed by Kozo Sugiyama, Shojiro Tagawa, and Mitsuhiko
# Toda in 1981, the Sugiyama framework is the dominant
# standard for drawing directed acyclic graphs (DAGs) and
# hierarchical flow diagrams (org charts, PERT charts, etc.).
#
# HOW IT WORKS (four stages):
#   1. Cycle removal: If the graph has cycles (like our
#      undirected karate graph), some edges are temporarily
#      reversed to make a DAG.
#   2. Layer assignment: Nodes are assigned to discrete
#      horizontal layers using a topological sort.
#   3. Crossing minimisation: Nodes within each layer are
#      reordered to reduce the number of edge crossings
#      between adjacent layers.
#   4. Coordinate assignment: Final x and y positions are
#      computed to produce straight vertical edges.
#
# STRENGTHS:
#   - Best-in-class for hierarchical and flow graphs.
#   - Minimises edge crossings algorithmically.
#   - Widely used in software architecture and workflow
#     visualisation (tools like Graphviz use it).
#
# WEAKNESSES:
#   - Designed for directed graphs; results on undirected
#     graphs like the karate club are less meaningful.
#   - The rigid layering can look unnatural for social
#     networks where hierarchy is not the dominant structure.
#
# WHAT TO NOTICE:
#   Nodes are placed on discrete horizontal "shelves".
#   The layout looks very different from the force-directed
#   ones — it emphasises hierarchy rather than community.
#   This illustrates that the right layout depends entirely
#   on what story you want to tell with the data.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_with_sugiyama(g)$layout
plot(g, layout = lay)`,
        },

        // ------------------------------------------------------------------
        // 16. layout_nicely (Automatic)
        // ------------------------------------------------------------------
        {
          labId: karateLayoutsLab.id,
          orderIndex: 15,
          title: '16. Nicely — Automatic Layout',
          description: 'layout_nicely — igraph picks the best algorithm for the graph automatically',
          code: `library(igraph)

# ============================================================
# Layout: Nicely  (layout_nicely)
# ============================================================
# layout_nicely is not an algorithm in itself — it is
# igraph's "smart default" dispatcher. It inspects the
# graph and selects the most appropriate algorithm from
# the available options:
#
#   If the graph is a TREE:          layout_as_tree
#   If <= 1000 nodes:                layout_with_fr
#   If <= 5000 nodes:                layout_with_drl
#   Otherwise (very large):          layout_with_lgl
#
# For our karate club graph (34 nodes, not a tree),
# layout_nicely will choose layout_with_fr — the same
# algorithm we used in template 7.
#
# WHY DOES THIS EXIST?
#   Beginners often don't know which layout to choose.
#   layout_nicely gives a reasonable result without
#   requiring knowledge of graph properties. It is the
#   layout used by default when you call plot(g) without
#   specifying a layout.
#
# WHEN TO USE IT:
#   - Quick exploratory visualisation.
#   - When you don't know the graph's properties yet.
#   - As a first pass before switching to a specific layout.
#
# WHEN NOT TO USE IT:
#   - When you need reproducibility (the chosen algorithm
#     may change between igraph versions).
#   - When you have domain knowledge that a specific layout
#     would be more meaningful (e.g., MDS for distance
#     analysis, tree layout for hierarchy).
#
# WHAT TO NOTICE:
#   The result should look essentially the same as template 7
#   (Fruchterman-Reingold). Both factions separate cleanly.
#   This is also what you see when you simply type plot(g)
#   without any layout argument in igraph.
# ============================================================

g <- make_graph("Zachary")
set.seed(42)
lay <- layout_nicely(g)
plot(g, layout = lay)`,
        },

      ],
    });
  }

  console.log('Created custom lab: Karate Club Layouts');
}

main()
  .catch((e) => {
    console.error('Error seeding labs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
