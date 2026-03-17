import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding custom labs and templates...');

  // Get admin user for createdBy
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (!admin) {
    throw new Error('Admin user not found. Run the main seed first.');
  }

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

  console.log('Created custom labs: TNA, Statistics, MSLQ, COLLES, R-SPQ-2F, SNA, Python, Python-SNA');
}

main()
  .catch((e) => {
    console.error('Error seeding labs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
