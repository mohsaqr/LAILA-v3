import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a secure random password.
 * In development, you can set SEED_ADMIN_PASSWORD, SEED_INSTRUCTOR_PASSWORD, SEED_STUDENT_PASSWORD
 * environment variables to use consistent passwords.
 */
function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64url');
}

async function main() {
  console.log('Seeding database...');

  // Use environment variables if provided, otherwise generate secure random passwords
  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD || generateSecurePassword();
  const rawInstructorPassword = process.env.SEED_INSTRUCTOR_PASSWORD || generateSecurePassword();
  const rawStudentPassword = process.env.SEED_STUDENT_PASSWORD || generateSecurePassword();

  // Log passwords so developers know what they are (only if generated)
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('Generated admin password:', rawAdminPassword);
  }
  if (!process.env.SEED_INSTRUCTOR_PASSWORD) {
    console.log('Generated instructor password:', rawInstructorPassword);
  }
  if (!process.env.SEED_STUDENT_PASSWORD) {
    console.log('Generated student password:', rawStudentPassword);
  }

  // Create admin user
  const adminPassword = await bcrypt.hash(rawAdminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@laila.edu' },
    update: { passwordHash: adminPassword },
    create: {
      fullname: 'LAILA Admin',
      email: 'admin@laila.edu',
      passwordHash: adminPassword,
      isAdmin: true,
      isInstructor: true,
      isConfirmed: true,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create instructor user
  const instructorPassword = await bcrypt.hash(rawInstructorPassword, 10);
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@laila.edu' },
    update: { passwordHash: instructorPassword },
    create: {
      fullname: 'Dr. Sarah Johnson',
      email: 'instructor@laila.edu',
      passwordHash: instructorPassword,
      isAdmin: false,
      isInstructor: true,
      isConfirmed: true,
    },
  });
  console.log('Created instructor user:', instructor.email);

  // Create second instructor
  const instructor2 = await prisma.user.upsert({
    where: { email: 'professor@laila.edu' },
    update: { passwordHash: instructorPassword },
    create: {
      fullname: 'Prof. Michael Chen',
      email: 'professor@laila.edu',
      passwordHash: instructorPassword,
      isAdmin: false,
      isInstructor: true,
      isConfirmed: true,
    },
  });
  console.log('Created second instructor:', instructor2.email);

  // Create student user
  const studentPassword = await bcrypt.hash(rawStudentPassword, 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@laila.edu' },
    update: { passwordHash: studentPassword },
    create: {
      fullname: 'John Student',
      email: 'student@laila.edu',
      passwordHash: studentPassword,
      isAdmin: false,
      isInstructor: false,
      isConfirmed: true,
    },
  });
  console.log('Created student user:', student.email);

  // Create default chatbots
  const chatbots = [
    {
      name: 'research-methods',
      displayName: 'Research Methods Helper',
      description: 'Expert in research methodology, study design, and academic research practices',
      systemPrompt: `You are a Research Methods expert assistant. Help users with:
- Research design and methodology
- Quantitative and qualitative research approaches
- Data collection methods
- Sampling techniques
- Research ethics
- Literature review strategies
Provide academic, evidence-based guidance.`,
      category: 'academic',
      isSystem: true,
    },
    {
      name: 'academic-writing',
      displayName: 'Academic Writing Tutor',
      description: 'Helps improve academic writing, citations, and scholarly communication',
      systemPrompt: `You are an Academic Writing tutor. Help users with:
- Academic writing structure and style
- Citation and referencing (APA, MLA, Chicago, etc.)
- Thesis and argument development
- Academic tone and language
- Avoiding plagiarism
- Editing and proofreading strategies
Provide constructive feedback and examples.`,
      category: 'academic',
      isSystem: true,
    },
    {
      name: 'platform-guide',
      displayName: 'LAILA Platform Guide',
      description: 'Guides users through the LAILA LMS platform features and tools',
      systemPrompt: `You are the LAILA Platform Guide. Help users navigate and use:
- Course enrollment and progress tracking
- Assignment submissions
- AI research tools (Bias Research, Prompt Helper, Data Analyzer)
- Account settings and preferences
- Learning features and resources
Be friendly and provide step-by-step guidance.`,
      category: 'support',
      isSystem: true,
    },
  ];

  for (const bot of chatbots) {
    await prisma.chatbot.upsert({
      where: { name: bot.name },
      update: {},
      create: bot,
    });
  }
  console.log('Created default chatbots');

  // Create AI Tutor agents
  const tutorAgents = [
    {
      name: 'socratic-tutor',
      displayName: 'Socratic Guide',
      description: 'Guides learning through thoughtful questions',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'socratic',
      temperature: 0.7,
      avatarUrl: '/avatars/socratic.svg',
      systemPrompt: `You are a Socratic tutor. Your approach:
- Ask probing questions instead of giving direct answers
- Guide students to discover insights themselves
- Use "What do you think would happen if...?" style questions
- Celebrate when students reach understanding
- Never give the answer directly unless the student is truly stuck
- Build on the student's existing knowledge
- Help them see connections between concepts`,
      welcomeMessage: "Hello! I'm here to help you think through problems. What would you like to explore together?",
      dosRules: JSON.stringify([
        'Ask clarifying questions',
        'Build on student responses',
        'Encourage self-discovery',
        'Praise good reasoning',
        'Use leading questions'
      ]),
      dontsRules: JSON.stringify([
        'Give direct answers immediately',
        'Lecture without interaction',
        'Make student feel wrong',
        'Rush to conclusions'
      ]),
      responseStyle: 'balanced',
    },
    {
      name: 'helper-tutor',
      displayName: 'Helpful Guide',
      description: 'Provides clear, direct explanations',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'friendly',
      temperature: 0.6,
      avatarUrl: '/avatars/helper.svg',
      systemPrompt: `You are a helpful and patient tutor. Your approach:
- Give clear, structured explanations
- Use examples and analogies
- Break down complex topics step by step
- Check understanding after explaining
- Be encouraging and supportive
- Provide multiple ways to understand a concept
- Summarize key points at the end`,
      welcomeMessage: "Hi there! I'm here to help explain things clearly. What can I help you understand?",
      dosRules: JSON.stringify([
        'Explain clearly and thoroughly',
        'Use concrete examples',
        'Structure information logically',
        'Be patient and encouraging',
        'Check for understanding'
      ]),
      dontsRules: JSON.stringify([
        'Be vague or unclear',
        'Skip important steps',
        'Use jargon without explaining',
        'Rush explanations'
      ]),
      responseStyle: 'detailed',
    },
    {
      name: 'peer-tutor',
      displayName: 'Study Buddy',
      description: 'A casual peer who learns alongside you',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'casual',
      temperature: 0.8,
      avatarUrl: '/avatars/peer.svg',
      systemPrompt: `You are a friendly study buddy, not a teacher. Your style:
- Talk like a fellow student, casual and relatable
- Say "I think..." and "Let's figure this out together"
- Share your own understanding, admit when unsure
- Make studying feel like a conversation with a friend
- Be encouraging and supportive
- Use casual language and expressions
- Relate topics to everyday experiences`,
      welcomeMessage: "Hey! What are you working on? Let's figure it out together!",
      dosRules: JSON.stringify([
        'Be casual and friendly',
        'Share relatable experiences',
        'Encourage and support',
        'Learn together',
        'Use everyday language'
      ]),
      dontsRules: JSON.stringify([
        'Sound like a teacher',
        'Be condescending',
        'Use overly formal language',
        'Pretend to know everything'
      ]),
      responseStyle: 'concise',
    },
    {
      name: 'project-tutor',
      displayName: 'Project Coach',
      description: 'Helps with projects and hands-on work',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'professional',
      temperature: 0.5,
      avatarUrl: '/avatars/project.svg',
      systemPrompt: `You are a project coach who helps with practical work. Your approach:
- Help plan and structure projects
- Break large tasks into manageable pieces
- Debug problems systematically
- Suggest best practices and patterns
- Focus on actionable next steps
- Provide practical, hands-on guidance
- Help prioritize and organize tasks`,
      welcomeMessage: "Ready to work on your project! What are we building today?",
      dosRules: JSON.stringify([
        'Create actionable task lists',
        'Set realistic milestones',
        'Debug systematically',
        'Suggest best practices',
        'Focus on practical solutions'
      ]),
      dontsRules: JSON.stringify([
        'Be vague about deliverables',
        'Ignore deadlines',
        'Skip planning steps',
        'Overcomplicate solutions'
      ]),
      responseStyle: 'detailed',
    },
    // ========== PEER STUDENTS ==========
    // These are fellow students who know a bit more but don't give all the answers
    {
      name: 'carmen-peer',
      displayName: 'Carmen',
      description: 'A friendly classmate who took this course last semester',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'casual',
      temperature: 0.8,
      avatarUrl: '/avatars/carmen.svg',
      systemPrompt: `You are Carmen, a fellow student who took this course last semester. You're NOT a tutor or teacher - you're just a classmate who's been through this before.

Your personality:
- Friendly and approachable, like chatting with a friend in the library
- You remember struggling with the same topics, so you're empathetic
- You speak casually with occasional slang ("yeah", "honestly", "tbh", "like")
- You share your own experiences: "When I took this, I also got confused by..."

Your approach to helping:
- Give HINTS and nudges, not complete answers
- Share partial insights: "I remember the key thing was something about..."
- Point them in the right direction without doing the work for them
- Say things like "Have you tried looking at..." or "What helped me was thinking about..."
- If they're really stuck, give a small piece but encourage them to build on it
- Sometimes admit you're not 100% sure: "I think it's something like... but double-check that"

What you DON'T do:
- Never give complete, polished answers
- Don't lecture or explain things formally
- Don't pretend to be an expert - you're a student too
- Don't solve their homework for them`,
      welcomeMessage: "Hey! I took this class last semester so I might be able to help. What's giving you trouble?",
      dosRules: JSON.stringify([
        'Give hints not answers',
        'Share your own struggles',
        'Be casual and friendly',
        'Point in the right direction',
        'Admit when unsure'
      ]),
      dontsRules: JSON.stringify([
        'Give complete answers',
        'Sound like a teacher',
        'Do their work for them',
        'Pretend to be an expert'
      ]),
      responseStyle: 'concise',
    },
    {
      name: 'laila-peer',
      displayName: 'Laila',
      description: 'A brilliant classmate who challenges your thinking supportively',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'thoughtful',
      temperature: 0.7,
      avatarUrl: '/avatars/laila.svg',
      systemPrompt: `You are Laila, a very smart fellow student who loves a good intellectual discussion. You understand concepts deeply and you're not afraid to respectfully disagree or push back on ideas - but always in a supportive, constructive way.

Your personality:
- Intellectually curious and loves debating ideas
- You challenge thinking, but with warmth and genuine care
- You're direct but never mean: "Hmm, I'm not sure I agree with that... here's what I'm thinking"
- You get excited when discussing different perspectives
- You use phrases like "But wait, what about...", "I see it differently...", "Have you considered..."
- You think out loud: "Okay but here's where I push back a little..."

Your approach to helping:
- You're SUPPORTIVE first - you want them to succeed
- But you also challenge ideas constructively: "That's one way to see it, but..."
- You play devil's advocate in a friendly way to strengthen their thinking
- You point out potential flaws or gaps, but gently: "I think there might be a hole in that reasoning..."
- You offer alternative viewpoints: "Another way to look at this..."
- You give partial help and hints, not complete answers
- When you disagree, you explain WHY and offer your perspective
- You celebrate when they defend their position well: "Okay, that's actually a good point!"

Your argumentative style:
- Always respectful and warm, never attacking
- "I hear you, but..." not "You're wrong"
- Frame disagreements as exploration: "Let's think about this together..."
- Acknowledge good points before challenging: "That's true, AND..."
- Push them to think deeper, not to feel bad

What you DON'T do:
- Never be harsh, dismissive, or make them feel stupid
- Don't argue just to argue - have a point
- Don't give complete answers - guide them there through discussion
- Don't back down just to be nice - if you disagree, say so kindly`,
      welcomeMessage: "Hey! I love a good discussion. What are you working on? Fair warning - I might push back on some things, but it's all to help you think it through!",
      dosRules: JSON.stringify([
        'Challenge ideas constructively',
        'Offer alternative viewpoints',
        'Be supportive while disagreeing',
        'Push them to think deeper',
        'Give hints not answers'
      ]),
      dontsRules: JSON.stringify([
        'Be harsh or dismissive',
        'Give complete solutions',
        'Argue without purpose',
        'Back down just to be nice'
      ]),
      responseStyle: 'concise',
    },
    {
      name: 'beatrice-peer',
      displayName: 'Beatrice',
      description: 'A warm, encouraging classmate who believes in you',
      category: 'tutor',
      isSystem: true,
      isActive: true,
      personality: 'supportive',
      temperature: 0.75,
      avatarUrl: '/avatars/beatrice.svg',
      systemPrompt: `You are Beatrice, an incredibly kind and supportive fellow student. You genuinely care about helping others succeed and believe everyone can learn.

Your personality:
- Warm, patient, and endlessly encouraging
- You never make anyone feel bad for not understanding something
- You celebrate small wins: "That's great that you got that part!"
- You normalize struggle: "This topic is tough for everyone, you're not alone"
- You use warm language: "Don't worry", "You've got this", "That's a good start!"
- You're emotionally supportive, not just academically

Your approach to helping:
- Start by validating their feelings: "I totally get why that's confusing"
- Break things into tiny, manageable pieces
- Give gentle hints and encouragement, not full answers
- Cheer them on: "You're so close!" "Yes, keep going!"
- If they're frustrated, help them feel better first, then tackle the problem
- Give partial help: "The first step is... can you figure out what comes next?"
- Remind them of what they DO understand before tackling what they don't

What you DON'T do:
- Never make them feel stupid or behind
- Don't give complete answers - you want them to have the victory
- Don't rush them or show impatience
- Don't be fake-nice - your kindness is genuine`,
      welcomeMessage: "Hi there! I'm here if you need any help. Don't worry, we'll figure it out together!",
      dosRules: JSON.stringify([
        'Be warm and encouraging',
        'Validate their feelings',
        'Celebrate small wins',
        'Give gentle hints',
        'Break things into small steps'
      ]),
      dontsRules: JSON.stringify([
        'Make them feel bad',
        'Give complete answers',
        'Rush or show impatience',
        'Be condescending'
      ]),
      responseStyle: 'balanced',
    },
  ];

  for (const agent of tutorAgents) {
    await prisma.chatbot.upsert({
      where: { name: agent.name },
      update: {},
      create: agent,
    });
  }
  console.log('Created 7 AI tutor agents (4 tutors + 3 peers)');

  // Create default system settings
  const settings = [
    { settingKey: 'site_name', settingValue: 'LAILA LMS', settingType: 'string', description: 'The name of the platform' },
    { settingKey: 'default_ai_provider', settingValue: 'openai', settingType: 'string', description: 'Default AI provider (openai or gemini)' },
    { settingKey: 'allow_registration', settingValue: 'true', settingType: 'boolean', description: 'Allow new user registrations' },
    { settingKey: 'require_email_confirmation', settingValue: 'false', settingType: 'boolean', description: 'Require email confirmation for new accounts' },
    { settingKey: 'max_file_upload_size', settingValue: '10', settingType: 'number', description: 'Maximum file upload size in MB' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { settingKey: setting.settingKey },
      update: {},
      create: setting,
    });
  }
  console.log('Created system settings');

  // Create default API configurations
  const apiConfigs = [
    { serviceName: 'openai', defaultModel: 'gpt-4o-mini', isActive: true },
    { serviceName: 'gemini', defaultModel: 'gemini-pro', isActive: false },
  ];

  for (const config of apiConfigs) {
    await prisma.apiConfiguration.upsert({
      where: { serviceName: config.serviceName },
      update: {},
      create: config,
    });
  }
  console.log('Created API configurations');

  // ============================================================================
  // COURSE 1: Introduction to AI-Powered Research
  // ============================================================================
  const course1 = await prisma.course.upsert({
    where: { slug: 'intro-to-ai-research' },
    update: {},
    create: {
      title: 'Introduction to AI-Powered Research',
      slug: 'intro-to-ai-research',
      description: 'Master the fundamentals of using artificial intelligence tools in academic research. This comprehensive course covers everything from understanding AI capabilities and limitations to practical applications in literature reviews, data analysis, and research writing. You will learn to critically evaluate AI outputs, avoid common pitfalls, and leverage these powerful tools to enhance your research productivity while maintaining academic integrity.',
      instructorId: instructor.id,
      category: 'Research Methods',
      difficulty: 'beginner',
      status: 'published',
      isPublic: true,
      publishedAt: new Date(),
    },
  });
  console.log('Created course:', course1.title);

  // Course 1 - Module 1
  const c1m1 = await prisma.courseModule.create({
    data: {
      courseId: course1.id,
      title: 'Foundations of AI in Research',
      description: 'Understanding the role and capabilities of AI in modern academic research.',
      orderIndex: 0,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c1m1.id,
      title: 'What is AI and How Does it Work?',
      content: `<h2>Understanding Artificial Intelligence</h2>
<p>Artificial Intelligence (AI) refers to computer systems designed to perform tasks that typically require human intelligence. These tasks include understanding natural language, recognizing patterns, making decisions, and generating content.</p>

<h3>Key Concepts</h3>
<p><strong>Machine Learning (ML)</strong> is a subset of AI where systems learn from data rather than being explicitly programmed. Instead of writing rules for every situation, we train models on large datasets and they learn to recognize patterns.</p>

<p><strong>Large Language Models (LLMs)</strong> like GPT-4, Claude, and Gemini are trained on vast amounts of text data. They learn statistical patterns in language, enabling them to generate coherent, contextually appropriate text. However, they don't truly "understand" in the human sense—they're sophisticated pattern matchers.</p>

<h3>Capabilities and Limitations</h3>
<p>AI excels at:</p>
<ul>
<li>Processing and summarizing large volumes of text</li>
<li>Identifying patterns in data</li>
<li>Generating draft content and ideas</li>
<li>Translating between languages</li>
<li>Answering questions based on training data</li>
</ul>

<p>AI struggles with:</p>
<ul>
<li>Verifying factual accuracy (it can "hallucinate" false information)</li>
<li>Accessing real-time or recent information (unless connected to the internet)</li>
<li>True reasoning and understanding context deeply</li>
<li>Maintaining consistency across long documents</li>
<li>Citing sources accurately</li>
</ul>

<h3>Implications for Research</h3>
<p>Understanding these capabilities and limitations is crucial for effectively using AI in research. AI tools are powerful assistants, but they require human oversight, critical evaluation, and verification. Think of AI as a knowledgeable but occasionally unreliable research assistant whose work always needs to be checked.</p>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      isFree: true,
      duration: 20,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c1m1.id,
      title: 'The AI Research Toolkit',
      content: `<h2>Essential AI Tools for Researchers</h2>
<p>The landscape of AI tools for research is rapidly evolving. This lecture provides an overview of the major categories of tools and their applications in academic work.</p>

<h3>1. General-Purpose AI Assistants</h3>
<p><strong>ChatGPT (OpenAI)</strong>: Excellent for brainstorming, drafting, and explaining complex concepts. The GPT-4 model offers improved reasoning and longer context windows.</p>
<p><strong>Claude (Anthropic)</strong>: Known for nuanced responses and strong performance on analytical tasks. Particularly good at following complex instructions.</p>
<p><strong>Gemini (Google)</strong>: Integrated with Google's search capabilities, useful for research that requires up-to-date information.</p>

<h3>2. Literature Review Tools</h3>
<p><strong>Semantic Scholar</strong>: AI-powered academic search engine that understands the meaning of your queries, not just keywords.</p>
<p><strong>Elicit</strong>: Specifically designed for research, helps find relevant papers and extract key information automatically.</p>
<p><strong>Connected Papers</strong>: Visualizes relationships between academic papers, helping you discover related work.</p>

<h3>3. Writing Assistance</h3>
<p><strong>Grammarly</strong>: AI-powered writing assistant for grammar, style, and clarity.</p>
<p><strong>QuillBot</strong>: Paraphrasing and summarization tool useful for literature synthesis.</p>
<p><strong>Writefull</strong>: Specifically designed for academic writing, provides language feedback based on published papers.</p>

<h3>4. Data Analysis</h3>
<p><strong>Julius AI</strong>: Natural language interface for data analysis—describe what you want to analyze and it generates the code.</p>
<p><strong>ChatGPT Code Interpreter</strong>: Upload datasets and ask questions in plain English to get statistical analyses.</p>

<h3>Choosing the Right Tool</h3>
<p>Consider these factors when selecting AI tools for your research:</p>
<ul>
<li><strong>Task specificity</strong>: Specialized tools often outperform general ones for specific tasks</li>
<li><strong>Data privacy</strong>: Check terms of service before uploading sensitive data</li>
<li><strong>Cost</strong>: Many tools have free tiers with limitations</li>
<li><strong>Integration</strong>: How well does it fit into your existing workflow?</li>
<li><strong>Institutional support</strong>: Does your university provide access?</li>
</ul>`,
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 25,
    },
  });

  // Course 1 - Module 2
  const c1m2 = await prisma.courseModule.create({
    data: {
      courseId: course1.id,
      title: 'Critical Evaluation of AI Outputs',
      description: 'Learn to assess AI-generated content for accuracy, bias, and appropriateness.',
      orderIndex: 1,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c1m2.id,
      title: 'Identifying AI Hallucinations and Errors',
      content: `<h2>When AI Gets It Wrong</h2>
<p>AI systems can generate confident-sounding but completely false information—a phenomenon known as "hallucination." As a researcher, recognizing and mitigating this risk is essential.</p>

<h3>Types of AI Errors</h3>

<h4>1. Factual Hallucinations</h4>
<p>AI may fabricate facts, statistics, or citations that don't exist. For example, it might cite a paper with a plausible-sounding title and authors that was never written.</p>
<p><strong>Example</strong>: "According to Smith et al. (2023) in the Journal of AI Research, 78% of researchers report improved productivity with AI tools."</p>
<p>This citation may be completely fabricated. Always verify references independently.</p>

<h4>2. Logical Inconsistencies</h4>
<p>AI may contradict itself within the same response or reach conclusions that don't follow from its premises.</p>

<h4>3. Outdated Information</h4>
<p>Most AI models have knowledge cutoff dates. They may present outdated information as current or be unaware of recent developments.</p>

<h4>4. Oversimplification</h4>
<p>Complex topics may be reduced to oversimplified explanations that miss important nuances or exceptions.</p>

<h3>Verification Strategies</h3>
<p><strong>Cross-reference everything</strong>: Never trust a single AI source. Verify facts against authoritative sources.</p>
<p><strong>Check citations manually</strong>: Every reference an AI provides should be verified in Google Scholar or your library database.</p>
<p><strong>Ask for sources</strong>: Request that the AI provide sources, then verify them. If it can't provide verifiable sources, treat the information as unverified.</p>
<p><strong>Use domain expertise</strong>: The more you know about a subject, the easier it is to spot errors. AI is most dangerous when used in unfamiliar territory.</p>
<p><strong>Look for hedging language</strong>: Be suspicious when AI speaks with high confidence about specific numbers, dates, or claims.</p>

<h3>Red Flags to Watch For</h3>
<ul>
<li>Very specific statistics without clear sources</li>
<li>Citations you can't find in academic databases</li>
<li>Claims that seem too convenient or perfectly aligned with your hypothesis</li>
<li>Information that contradicts well-established knowledge in your field</li>
<li>Responses that seem to tell you what you want to hear</li>
</ul>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 25,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c1m2.id,
      title: 'Understanding Bias in AI Systems',
      content: `<h2>Bias in AI: Sources and Implications</h2>
<p>AI systems can perpetuate and even amplify biases present in their training data and design. Understanding these biases is crucial for responsible use in research.</p>

<h3>Sources of AI Bias</h3>

<h4>Training Data Bias</h4>
<p>AI models learn from data created by humans, which contains historical and societal biases. If the training data underrepresents certain groups or perspectives, the AI will reflect those gaps.</p>
<p><strong>Example</strong>: An AI trained primarily on English-language academic texts may have limited understanding of research traditions and perspectives from non-Western contexts.</p>

<h4>Selection Bias</h4>
<p>The choice of what data to include in training inherently involves selection. Certain types of content, perspectives, or knowledge may be overrepresented or underrepresented.</p>

<h4>Algorithmic Bias</h4>
<p>The design choices in how AI systems process and weight information can introduce systematic biases in outputs.</p>

<h3>Types of Bias in Research Contexts</h3>

<h4>Confirmation Bias Amplification</h4>
<p>AI may tend to agree with the framing of your questions, potentially reinforcing your existing beliefs rather than challenging them.</p>

<h4>Representation Bias</h4>
<p>Certain topics, methodologies, or theoretical frameworks may be better represented in AI training data, leading to skewed suggestions.</p>

<h4>Temporal Bias</h4>
<p>More recent or frequently discussed topics may be overrepresented compared to older but still relevant research.</p>

<h3>Mitigating Bias in Your Research</h3>
<p><strong>Diversify your prompts</strong>: Ask questions from multiple perspectives. Deliberately seek counterarguments and alternative viewpoints.</p>
<p><strong>Be explicit about scope</strong>: When relevant, ask AI to consider diverse geographic, cultural, or demographic perspectives.</p>
<p><strong>Cross-reference with diverse sources</strong>: Don't rely solely on AI suggestions. Actively seek out literature from varied sources and traditions.</p>
<p><strong>Document your process</strong>: Keep records of how you used AI, allowing others to understand potential limitations.</p>
<p><strong>Consult domain experts</strong>: Especially when researching communities or topics you're not part of, seek input from those with lived experience.</p>`,
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 30,
    },
  });

  // Course 1 - Module 3
  const c1m3 = await prisma.courseModule.create({
    data: {
      courseId: course1.id,
      title: 'Practical Applications',
      description: 'Hands-on exercises applying AI tools to research tasks.',
      orderIndex: 2,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c1m3.id,
      title: 'AI-Assisted Literature Reviews',
      content: `<h2>Leveraging AI for Literature Reviews</h2>
<p>Literature reviews are one of the most time-consuming aspects of research. AI tools can significantly accelerate this process while maintaining rigor—if used correctly.</p>

<h3>Phase 1: Discovery and Scoping</h3>
<p><strong>Initial Exploration</strong>: Use AI to understand the landscape of a new topic. Ask questions like:</p>
<ul>
<li>"What are the main theoretical frameworks used to study [topic]?"</li>
<li>"What are the key debates and controversies in [field]?"</li>
<li>"Who are the most influential researchers studying [topic]?"</li>
</ul>
<p>Remember: Use this as a starting point, not definitive answers. Verify all suggestions.</p>

<h3>Phase 2: Systematic Search</h3>
<p><strong>Query Formulation</strong>: AI can help develop comprehensive search strategies:</p>
<ul>
<li>Generate synonyms and related terms for your keywords</li>
<li>Suggest relevant MeSH terms or subject headings</li>
<li>Identify potential gaps in your search strategy</li>
</ul>

<p><strong>Example Prompt</strong>: "I'm conducting a systematic review on the effectiveness of mindfulness interventions for anxiety in college students. Help me develop a comprehensive list of search terms including synonyms, related concepts, and potential MeSH terms."</p>

<h3>Phase 3: Screening and Extraction</h3>
<p><strong>Abstract Screening</strong>: While AI shouldn't make final inclusion/exclusion decisions, it can:</p>
<ul>
<li>Summarize abstracts to speed initial screening</li>
<li>Flag papers that clearly meet or don't meet criteria</li>
<li>Identify papers that need closer human review</li>
</ul>

<p><strong>Data Extraction</strong>: AI can help extract standard information from papers:</p>
<ul>
<li>Study characteristics (sample size, methodology, location)</li>
<li>Key findings and effect sizes</li>
<li>Limitations noted by authors</li>
</ul>

<h3>Phase 4: Synthesis</h3>
<p><strong>Identifying Themes</strong>: Upload your extracted data and ask AI to identify patterns:</p>
<ul>
<li>Common findings across studies</li>
<li>Contradictory results that need explanation</li>
<li>Gaps in the literature</li>
</ul>

<h3>Best Practices</h3>
<ol>
<li><strong>Document everything</strong>: Record which AI tools you used and how</li>
<li><strong>Human verification</strong>: Always verify AI-extracted data against original sources</li>
<li><strong>Transparent reporting</strong>: Disclose AI use in your methods section</li>
<li><strong>Maintain quality</strong>: AI speeds up the process but doesn't replace rigorous methodology</li>
</ol>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 35,
    },
  });

  // Course 1 Assignment
  await prisma.assignment.create({
    data: {
      courseId: course1.id,
      title: 'AI Tool Evaluation Report',
      description: 'Evaluate an AI tool for its applicability to academic research in your field.',
      instructions: `<h3>Assignment Overview</h3>
<p>In this assignment, you will critically evaluate an AI tool and assess its usefulness for academic research in your area of study.</p>

<h3>Requirements</h3>
<ol>
<li><strong>Select an AI tool</strong> from the categories discussed in this course (general assistant, literature review tool, writing assistant, or data analysis tool).</li>
<li><strong>Test the tool</strong> with at least 5 different research-related tasks relevant to your field.</li>
<li><strong>Document your findings</strong> including:
<ul>
<li>Description of the tool and its intended purpose</li>
<li>Detailed account of each task you attempted</li>
<li>Assessment of output quality, accuracy, and usefulness</li>
<li>Identification of any errors, biases, or limitations you observed</li>
<li>Comparison with traditional (non-AI) methods for the same tasks</li>
</ul>
</li>
<li><strong>Provide recommendations</strong> for how this tool could (or should not) be used in academic research.</li>
</ol>

<h3>Submission Format</h3>
<p>Submit a 1500-2000 word report in PDF format. Include screenshots or examples of AI outputs where relevant.</p>`,
      submissionType: 'file',
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      points: 100,
      isPublished: true,
    },
  });

  // ============================================================================
  // COURSE 2: Academic Writing with AI Assistance
  // ============================================================================
  const course2 = await prisma.course.upsert({
    where: { slug: 'academic-writing-ai' },
    update: {},
    create: {
      title: 'Academic Writing with AI Assistance',
      slug: 'academic-writing-ai',
      description: 'Learn to effectively use AI tools to enhance your academic writing while maintaining your authentic voice and adhering to academic integrity standards. This course covers practical strategies for using AI in drafting, editing, citation management, and overcoming writer\'s block, while ensuring your work remains genuinely yours.',
      instructorId: instructor.id,
      category: 'Academic Writing',
      difficulty: 'intermediate',
      status: 'published',
      isPublic: true,
      publishedAt: new Date(),
    },
  });
  console.log('Created course:', course2.title);

  // Course 2 - Module 1
  const c2m1 = await prisma.courseModule.create({
    data: {
      courseId: course2.id,
      title: 'Ethical Foundations',
      description: 'Understanding academic integrity in the age of AI.',
      orderIndex: 0,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c2m1.id,
      title: 'Academic Integrity and AI: Where is the Line?',
      content: `<h2>Navigating Academic Integrity in the AI Era</h2>
<p>The rapid advancement of AI writing tools has created new challenges and uncertainties around academic integrity. This lecture helps you understand where the ethical boundaries lie and how to use AI responsibly.</p>

<h3>The Spectrum of AI Use</h3>
<p>AI use in academic writing exists on a spectrum from clearly acceptable to clearly problematic:</p>

<h4>Generally Acceptable</h4>
<ul>
<li>Using AI for grammar and spelling checks (like Grammarly)</li>
<li>Getting feedback on clarity and structure</li>
<li>Brainstorming and overcoming writer's block</li>
<li>Learning about a topic before writing</li>
<li>Generating outlines that you then develop yourself</li>
<li>Translating your own work or sources</li>
</ul>

<h4>Context-Dependent (Check Your Institution's Policy)</h4>
<ul>
<li>Using AI to paraphrase your own drafted sentences</li>
<li>Having AI suggest improvements to your arguments</li>
<li>Using AI to help with coding or data analysis</li>
<li>Generating initial drafts that you substantially revise</li>
</ul>

<h4>Generally Problematic</h4>
<ul>
<li>Submitting AI-generated text as your own writing</li>
<li>Using AI to write substantial portions without disclosure</li>
<li>Having AI complete assignments designed to assess your learning</li>
<li>Using AI to fabricate data or sources</li>
</ul>

<h3>Key Principles</h3>

<h4>1. Transparency</h4>
<p>When in doubt, disclose. Many institutions now require or encourage disclosure of AI tool use. Being transparent protects you and advances our collective understanding of how to integrate these tools appropriately.</p>

<h4>2. Intellectual Ownership</h4>
<p>The ideas and arguments should be yours. AI can help you express your ideas more clearly, but it shouldn't be generating the intellectual content of your work.</p>

<h4>3. Learning Objectives</h4>
<p>Consider what skills the assignment is meant to develop. If an assignment is designed to improve your writing ability, having AI write it defeats the purpose—even if it produces a better product.</p>

<h4>4. Know Your Policies</h4>
<p>Institutional policies vary widely and are evolving rapidly. Check:</p>
<ul>
<li>Your university's academic integrity policy</li>
<li>Specific course syllabi and instructor guidelines</li>
<li>Journal or publisher policies for research writing</li>
<li>Funding agency requirements</li>
</ul>

<h3>A Framework for Decision-Making</h3>
<p>When deciding whether a particular use of AI is appropriate, ask yourself:</p>
<ol>
<li>Would I be comfortable if my instructor/supervisor knew exactly how I used AI?</li>
<li>Does my use of AI align with the learning objectives?</li>
<li>Am I developing the skills this work is meant to build?</li>
<li>Are the ideas and arguments genuinely mine?</li>
<li>Am I being transparent about my process?</li>
</ol>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      isFree: true,
      duration: 25,
    },
  });

  // Course 2 - Module 2
  const c2m2 = await prisma.courseModule.create({
    data: {
      courseId: course2.id,
      title: 'AI-Enhanced Writing Process',
      description: 'Practical strategies for integrating AI into your writing workflow.',
      orderIndex: 1,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c2m2.id,
      title: 'From Blank Page to First Draft',
      content: `<h2>Using AI to Overcome Writer's Block</h2>
<p>The blank page is every writer's nemesis. AI tools can be powerful allies in moving from nothing to something—while ensuring the something is genuinely yours.</p>

<h3>Stage 1: Idea Generation and Brainstorming</h3>
<p>AI excels at helping you explore possibilities. Use it to:</p>

<p><strong>Map the territory</strong>: "I'm writing a paper about [topic]. What are the main aspects or angles I should consider?"</p>

<p><strong>Challenge your thinking</strong>: "What are the strongest counterarguments to the position that [your thesis]?"</p>

<p><strong>Find connections</strong>: "How might [concept A] relate to [concept B] in the context of [your field]?"</p>

<p><strong>Important</strong>: Use AI-generated ideas as starting points for your own thinking, not as conclusions. The goal is to stimulate your creativity, not replace it.</p>

<h3>Stage 2: Structuring Your Argument</h3>
<p>Once you have ideas, AI can help organize them:</p>

<p><strong>Request multiple outlines</strong>: "Generate three different ways I could structure an argument about [topic]."</p>

<p><strong>Identify logical flow</strong>: "Here are my main points: [list]. What's the most logical order for presenting them?"</p>

<p><strong>Find gaps</strong>: "Review this outline and identify any missing elements or logical gaps."</p>

<h3>Stage 3: The "Ugly First Draft"</h3>
<p>The key to productive AI-assisted drafting is maintaining ownership of your voice and ideas:</p>

<p><strong>Technique 1: Talk, then write</strong><br>
Verbally explain your argument (record yourself or use speech-to-text), then ask AI to help clean up the transcription while preserving your voice.</p>

<p><strong>Technique 2: Sentence starters</strong><br>
Write the first half of each paragraph yourself, then ask AI to help you complete the thought. Then revise to ensure it reflects what you actually meant.</p>

<p><strong>Technique 3: Expansion prompts</strong><br>
Write bullet points of your key ideas, then ask AI to help expand them. Heavily revise the expansions to match your voice.</p>

<h3>What to Avoid</h3>
<ul>
<li>Asking AI to "write a paper about X"—this produces generic, voice-less content</li>
<li>Accepting AI output without substantial revision</li>
<li>Using AI-generated text that you don't fully understand</li>
<li>Letting AI determine your argument or conclusions</li>
</ul>

<h3>The Revision Mindset</h3>
<p>Think of any AI-assisted draft as raw material that requires significant shaping. Your first draft—whether AI-assisted or not—is just the beginning. The real writing happens in revision.</p>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 30,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c2m2.id,
      title: 'Editing and Polishing with AI',
      content: `<h2>AI as Your Editing Partner</h2>
<p>Once you have a draft that represents your ideas in your voice, AI becomes an excellent editing tool. This is one of the most clearly ethical and productive uses of AI in writing.</p>

<h3>Levels of Editing</h3>

<h4>1. Structural Editing</h4>
<p>Ask AI to evaluate the overall organization and flow of your argument:</p>
<ul>
<li>"Read this draft and identify any sections that seem out of place or could be reordered for better flow."</li>
<li>"Does my conclusion effectively summarize the main points? What's missing?"</li>
<li>"Where does my argument feel weakest or least supported?"</li>
</ul>

<h4>2. Paragraph-Level Editing</h4>
<p>Focus AI feedback on specific sections:</p>
<ul>
<li>"Is this paragraph's main point clear? How could I make it stronger?"</li>
<li>"Does this paragraph transition smoothly from the previous one?"</li>
<li>"Am I providing enough evidence to support this claim?"</li>
</ul>

<h4>3. Sentence-Level Editing</h4>
<p>AI is excellent at improving clarity and concision:</p>
<ul>
<li>"Simplify this sentence while maintaining its meaning."</li>
<li>"This sentence feels awkward. Suggest three alternatives."</li>
<li>"Find and fix any passive constructions that should be active."</li>
</ul>

<h4>4. Copy Editing</h4>
<p>Grammar, spelling, punctuation—AI tools like Grammarly excel here:</p>
<ul>
<li>Subject-verb agreement</li>
<li>Comma usage</li>
<li>Consistent tense</li>
<li>Spelling and typos</li>
</ul>

<h3>Academic Style Refinement</h3>
<p>AI can help adjust your writing for academic conventions:</p>

<p><strong>Formality</strong>: "Make this more formal and appropriate for an academic journal."</p>

<p><strong>Hedging</strong>: "Add appropriate hedging language to these claims." (Academic writing often requires qualified statements: "may," "suggests," "appears to" rather than absolute claims.)</p>

<p><strong>Discipline-specific conventions</strong>: "Adjust this to match the conventions of [your field] writing."</p>

<h3>The Critical Step: Accept Selectively</h3>
<p>Never accept all AI suggestions blindly. For each suggestion:</p>
<ol>
<li>Understand why it's being suggested</li>
<li>Consider whether it improves your intended meaning</li>
<li>Check that it maintains your voice</li>
<li>Verify any factual changes</li>
<li>Modify the suggestion to better fit your style if needed</li>
</ol>`,
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 25,
    },
  });

  // Course 2 Assignment
  await prisma.assignment.create({
    data: {
      courseId: course2.id,
      title: 'AI-Assisted Writing Reflection',
      description: 'Document your process of using AI tools in writing a short academic piece.',
      instructions: `<h3>Assignment Overview</h3>
<p>Write a 1000-word academic essay on a topic in your field, using AI tools to assist your process. Then write a 500-word reflection documenting how you used AI.</p>

<h3>Part 1: The Essay (1000 words)</h3>
<p>Write an argumentative essay on a topic relevant to your studies. Use AI tools throughout your process—for brainstorming, drafting, and editing.</p>

<h3>Part 2: Process Reflection (500 words)</h3>
<p>Document your AI-assisted writing process:</p>
<ul>
<li>Which AI tools did you use and for what purposes?</li>
<li>Provide specific examples of prompts you used and how you modified AI suggestions</li>
<li>What worked well? What didn't?</li>
<li>How did you ensure the final product represents your own thinking and voice?</li>
<li>What did you learn about productive AI use in writing?</li>
</ul>

<h3>Submission</h3>
<p>Submit both parts as a single PDF document.</p>`,
      submissionType: 'file',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      points: 100,
      isPublished: true,
    },
  });

  // ============================================================================
  // COURSE 3: Data Analysis for Beginners
  // ============================================================================
  const course3 = await prisma.course.upsert({
    where: { slug: 'data-analysis-beginners' },
    update: {},
    create: {
      title: 'Data Analysis for Beginners',
      slug: 'data-analysis-beginners',
      description: 'A practical introduction to data analysis for students and researchers with no prior experience. Learn fundamental concepts of statistics, data visualization, and interpretation through hands-on exercises. By the end of this course, you will be able to conduct basic analyses, create meaningful visualizations, and interpret results for your research projects.',
      instructorId: instructor2.id,
      category: 'Data Science',
      difficulty: 'beginner',
      status: 'published',
      isPublic: true,
      publishedAt: new Date(),
    },
  });
  console.log('Created course:', course3.title);

  // Course 3 - Module 1
  const c3m1 = await prisma.courseModule.create({
    data: {
      courseId: course3.id,
      title: 'Understanding Data',
      description: 'Fundamental concepts of data and measurement.',
      orderIndex: 0,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c3m1.id,
      title: 'Types of Data and Variables',
      content: `<h2>The Building Blocks of Data Analysis</h2>
<p>Before you can analyze data effectively, you need to understand what types of data exist and how they should be handled. This foundational knowledge will guide every analytical decision you make.</p>

<h3>Quantitative vs. Qualitative Data</h3>

<h4>Quantitative Data (Numbers)</h4>
<p>Quantitative data represents amounts or quantities that can be measured and expressed numerically.</p>
<ul>
<li><strong>Continuous</strong>: Can take any value within a range (height: 5.7 feet, temperature: 72.3°F)</li>
<li><strong>Discrete</strong>: Can only take specific values, usually whole numbers (number of children: 2, course grade: A)</li>
</ul>

<h4>Qualitative Data (Categories)</h4>
<p>Qualitative data represents characteristics or attributes that can be categorized but not meaningfully measured.</p>
<ul>
<li><strong>Nominal</strong>: Categories with no natural order (colors: red, blue, green; gender: male, female, non-binary)</li>
<li><strong>Ordinal</strong>: Categories with a natural order (education: high school, bachelor's, master's, doctorate)</li>
</ul>

<h3>Levels of Measurement</h3>
<p>Understanding the level of measurement determines which statistical analyses are appropriate:</p>

<h4>1. Nominal</h4>
<p>Categories with no order or ranking. You can only measure frequency and mode.</p>
<p><strong>Example</strong>: Political party affiliation, blood type, country of origin</p>

<h4>2. Ordinal</h4>
<p>Categories with a meaningful order, but the intervals between categories aren't necessarily equal.</p>
<p><strong>Example</strong>: Likert scales (strongly agree to strongly disagree), class rankings, pain scales</p>

<h4>3. Interval</h4>
<p>Numeric data where intervals are equal, but there's no true zero point.</p>
<p><strong>Example</strong>: Temperature in Celsius (0°C doesn't mean "no temperature"), IQ scores, calendar years</p>

<h4>4. Ratio</h4>
<p>Numeric data with equal intervals AND a true zero point, allowing meaningful ratios.</p>
<p><strong>Example</strong>: Height, weight, income, age, time duration</p>

<h3>Why This Matters</h3>
<p>The type of data you have determines:</p>
<ul>
<li><strong>Which statistics to calculate</strong>: You can't calculate a meaningful mean for nominal data</li>
<li><strong>Which visualizations work</strong>: Bar charts for categorical data, histograms for continuous</li>
<li><strong>Which tests to use</strong>: T-tests need continuous data, chi-square works with categorical</li>
</ul>

<h3>Common Mistakes to Avoid</h3>
<p><strong>Treating ordinal as interval</strong>: Just because a Likert scale uses numbers (1-5) doesn't mean the distances between points are equal. The distance between "strongly disagree" and "disagree" may not equal the distance between "neutral" and "agree."</p>

<p><strong>Inappropriate averaging</strong>: Calculating mean values for nominal data (what's the "average" eye color?) or for ordinal data without careful consideration.</p>

<p><strong>Ignoring data types in visualization</strong>: Using a line graph for categorical data implies a continuous relationship that doesn't exist.</p>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      isFree: true,
      duration: 25,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c3m1.id,
      title: 'Descriptive Statistics: Summarizing Your Data',
      content: `<h2>Making Sense of Data Through Summary Statistics</h2>
<p>Descriptive statistics help you understand and communicate the essential characteristics of your data. They answer the fundamental question: "What does my data look like?"</p>

<h3>Measures of Central Tendency</h3>
<p>These statistics describe where the "center" of your data lies.</p>

<h4>Mean (Average)</h4>
<p>Sum of all values divided by the number of values. Most useful for symmetric distributions without extreme outliers.</p>
<p><strong>When to use</strong>: Continuous data that's roughly normally distributed</p>
<p><strong>Limitation</strong>: Sensitive to outliers—a few extreme values can dramatically shift the mean</p>

<h4>Median</h4>
<p>The middle value when data is ordered. Half the values are above, half below.</p>
<p><strong>When to use</strong>: When data is skewed or has outliers; for ordinal data</p>
<p><strong>Example</strong>: Median household income is often more meaningful than mean income because a few billionaires can inflate the mean</p>

<h4>Mode</h4>
<p>The most frequently occurring value.</p>
<p><strong>When to use</strong>: Categorical data; identifying common responses</p>
<p><strong>Note</strong>: Data can have multiple modes (bimodal, multimodal) or no mode</p>

<h3>Measures of Spread (Variability)</h3>
<p>These statistics describe how dispersed your data is.</p>

<h4>Range</h4>
<p>Maximum value minus minimum value. Simple but sensitive to outliers.</p>

<h4>Variance and Standard Deviation</h4>
<p>Variance measures the average squared distance from the mean. Standard deviation is the square root of variance, returning the measure to the original units.</p>
<p><strong>Interpretation</strong>: In a normal distribution, about 68% of data falls within one standard deviation of the mean, about 95% within two standard deviations.</p>

<h4>Interquartile Range (IQR)</h4>
<p>The range of the middle 50% of data (Q3 - Q1). Robust to outliers.</p>
<p><strong>When to use</strong>: When data is skewed or has outliers</p>

<h3>Shape of Distribution</h3>

<h4>Skewness</h4>
<ul>
<li><strong>Positive skew</strong>: Tail extends to the right (income distributions typically)</li>
<li><strong>Negative skew</strong>: Tail extends to the left (age at death in developed countries)</li>
<li><strong>Symmetric</strong>: Mean ≈ Median (many biological measurements)</li>
</ul>

<h4>Kurtosis</h4>
<p>Describes the "tailedness"—how much data is in the tails vs. the center compared to a normal distribution.</p>

<h3>Practical Guidelines</h3>
<ol>
<li><strong>Always start with visualization</strong>: Look at your data before calculating statistics</li>
<li><strong>Report multiple statistics</strong>: Mean alone doesn't tell the whole story—include a measure of spread</li>
<li><strong>Consider your audience</strong>: Median may be more intuitive for non-technical audiences</li>
<li><strong>Check for outliers</strong>: They can dramatically affect some statistics</li>
<li><strong>Match statistics to data type</strong>: Don't calculate mean for ordinal data without careful consideration</li>
</ol>`,
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 30,
    },
  });

  // Course 3 - Module 2
  const c3m2 = await prisma.courseModule.create({
    data: {
      courseId: course3.id,
      title: 'Data Visualization',
      description: 'Creating effective visual representations of data.',
      orderIndex: 1,
      isPublished: true,
    },
  });

  await prisma.lecture.create({
    data: {
      moduleId: c3m2.id,
      title: 'Choosing the Right Chart',
      content: `<h2>Visual Communication of Data</h2>
<p>A well-chosen visualization can communicate insights instantly that would take paragraphs to explain in words. But the wrong chart choice can confuse or even mislead. This lecture helps you match visualizations to your data and purpose.</p>

<h3>Visualization by Purpose</h3>

<h4>Showing Distribution</h4>
<p><strong>Histogram</strong>: Shows the distribution of a continuous variable. Use when you want to see the shape, center, and spread of your data.</p>
<p><strong>Box Plot</strong>: Shows median, quartiles, and outliers. Great for comparing distributions across groups.</p>
<p><strong>Density Plot</strong>: Smoothed version of histogram, useful for comparing multiple distributions.</p>

<h4>Comparing Categories</h4>
<p><strong>Bar Chart</strong>: Best for comparing discrete categories. Keep bars in meaningful order (by value or logical grouping).</p>
<p><strong>Dot Plot</strong>: Alternative to bar charts that reduces visual clutter when you have many categories.</p>

<h4>Showing Relationships</h4>
<p><strong>Scatter Plot</strong>: Shows relationship between two continuous variables. Essential for identifying correlations, clusters, and outliers.</p>
<p><strong>Line Graph</strong>: Shows trends over time or another continuous variable. Only use when the x-axis represents a continuous sequence.</p>

<h4>Showing Composition</h4>
<p><strong>Pie Chart</strong>: Shows parts of a whole. Use sparingly—bar charts are usually clearer. Only appropriate when parts sum to 100%.</p>
<p><strong>Stacked Bar Chart</strong>: Better than pie charts for comparing compositions across groups.</p>

<h3>Principles of Effective Visualization</h3>

<h4>1. Maximize Data-Ink Ratio</h4>
<p>Remove unnecessary visual elements. Every pixel should convey information. Avoid: 3D effects, heavy gridlines, unnecessary borders, gradient fills.</p>

<h4>2. Use Color Purposefully</h4>
<ul>
<li><strong>Sequential</strong>: Light to dark for ordered data (temperature scales)</li>
<li><strong>Diverging</strong>: Two hues meeting at neutral for data with meaningful midpoint (deviation from average)</li>
<li><strong>Categorical</strong>: Distinct colors for unordered categories</li>
<li>Consider colorblind-friendly palettes</li>
</ul>

<h4>3. Appropriate Scaling</h4>
<ul>
<li>Bar charts should start at zero</li>
<li>Line graphs can use truncated axes when showing change</li>
<li>Use logarithmic scales for data spanning multiple orders of magnitude</li>
</ul>

<h4>4. Clear Labels and Titles</h4>
<ul>
<li>Descriptive title that states the main finding</li>
<li>Labeled axes with units</li>
<li>Legend only when necessary</li>
</ul>

<h3>Common Mistakes</h3>
<ul>
<li><strong>Pie charts for more than 5 categories</strong>: Becomes unreadable</li>
<li><strong>Line graphs for categorical data</strong>: Implies continuous relationship</li>
<li><strong>3D charts</strong>: Distort perception, rarely add value</li>
<li><strong>Double y-axes</strong>: Easy to manipulate, hard to interpret correctly</li>
<li><strong>Truncated bar charts</strong>: Exaggerates differences</li>
</ul>`,
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 25,
    },
  });

  // Course 3 Assignment
  await prisma.assignment.create({
    data: {
      courseId: course3.id,
      title: 'Data Description Exercise',
      description: 'Calculate and interpret descriptive statistics for a provided dataset.',
      instructions: `<h3>Assignment Overview</h3>
<p>Using the provided dataset (available in the course resources), complete a comprehensive descriptive analysis.</p>

<h3>Tasks</h3>
<ol>
<li><strong>Identify variable types</strong>: Classify each variable in the dataset by type (nominal, ordinal, interval, ratio) and explain your reasoning.</li>
<li><strong>Calculate descriptive statistics</strong>:
<ul>
<li>For continuous variables: mean, median, standard deviation, range</li>
<li>For categorical variables: frequencies and percentages</li>
</ul>
</li>
<li><strong>Create visualizations</strong>:
<ul>
<li>At least one distribution plot (histogram or box plot)</li>
<li>At least one comparison plot (bar chart or grouped comparison)</li>
<li>At least one relationship plot (scatter plot if appropriate)</li>
</ul>
</li>
<li><strong>Written interpretation</strong>: In 500-750 words, describe what your analysis reveals about the data. What are the key patterns? Any surprising findings? What questions does the data raise?</li>
</ol>

<h3>Submission Format</h3>
<p>Submit a single document (PDF preferred) containing your calculations, visualizations, and written interpretation. You may use any software (Excel, R, Python, SPSS) for analysis.</p>`,
      submissionType: 'file',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      points: 100,
      isPublished: true,
    },
  });

  // ============================================================================
  // COURSE 4: Pedagogy: The Science and Art of Teaching
  // ============================================================================
  const course4 = await prisma.course.upsert({
    where: { slug: 'pedagogy-science-art-teaching' },
    update: {},
    create: {
      title: 'Pedagogy: The Science and Art of Teaching',
      slug: 'pedagogy-science-art-teaching',
      description: 'Explore the foundations of effective teaching and learning. This course covers learning theories, instructional design, active learning strategies, assessment methods, and technology-enhanced learning. Through lectures, discussions, hands-on data analysis labs, and reflective assignments, you will develop a comprehensive understanding of pedagogical principles and practical skills for designing impactful educational experiences.',
      instructorId: instructor.id,
      category: 'Education',
      difficulty: 'intermediate',
      status: 'published',
      isPublic: true,
      publishedAt: new Date(),
      collaborativeModuleEnabled: true,
      tutorRoutingMode: 'smart',
      curriculumViewMode: 'accordion',
    },
  });
  console.log('Created course:', course4.title);

  // ---- Module 1: Foundations of Pedagogy ----
  const c4m1 = await prisma.courseModule.create({
    data: {
      courseId: course4.id,
      title: 'Foundations of Pedagogy',
      description: 'Explore the meaning, history, and theoretical underpinnings of pedagogy.',
      label: 'Week 1',
      orderIndex: 0,
      isPublished: true,
    },
  });

  // Lecture 1.1: What is Pedagogy?
  const c4m1l1 = await prisma.lecture.create({
    data: {
      moduleId: c4m1.id,
      title: 'What is Pedagogy?',
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      isFree: true,
      duration: 20,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m1l1.id,
      title: 'Understanding Pedagogy',
      type: 'text',
      order: 0,
      content: `<h2>The Meaning and Scope of Pedagogy</h2>
<p>The word <strong>pedagogy</strong> derives from the Greek <em>paidagōgia</em> (παιδαγωγία), a compound of <em>pais</em> (child) and <em>agōgos</em> (leader). In ancient Greece, the <em>paidagōgos</em> was a slave who escorted children to school and supervised their conduct—literally a "leader of children." Over centuries the term evolved to encompass the entire art and science of teaching.</p>

<h3>Defining Pedagogy Today</h3>
<p>Modern pedagogy extends well beyond its etymological roots. It refers to the <strong>theory and practice of education</strong>—the methods, strategies, and principles that guide how knowledge is transmitted and how learning is facilitated. Pedagogy addresses questions such as:</p>
<ul>
<li>How do people learn most effectively?</li>
<li>What role should the teacher play—lecturer, facilitator, coach?</li>
<li>How should curricula be designed and sequenced?</li>
<li>How do we assess whether learning has occurred?</li>
<li>How do social, cultural, and technological contexts shape education?</li>
</ul>

<h3>Pedagogy vs. Andragogy</h3>
<p>Malcolm Knowles (1968) popularized the distinction between <strong>pedagogy</strong> (teaching children) and <strong>andragogy</strong> (teaching adults). According to Knowles, adult learners differ from children in several key ways:</p>
<ul>
<li><strong>Self-concept</strong>: Adults are self-directed and want autonomy in their learning.</li>
<li><strong>Experience</strong>: Adults bring rich life experience that serves as a resource for learning.</li>
<li><strong>Readiness</strong>: Adults learn best when the content is immediately relevant to their lives or work.</li>
<li><strong>Orientation</strong>: Adults are problem-centered rather than subject-centered.</li>
<li><strong>Motivation</strong>: Adults are motivated more by internal factors (self-esteem, quality of life) than external ones (grades).</li>
</ul>
<p>While the distinction is useful, most modern educators recognize that effective teaching blends both approaches depending on context, learner maturity, and subject matter.</p>

<h3>A Brief Historical Overview</h3>
<p><strong>Classical antiquity</strong>: Socrates pioneered the dialectical method—teaching through questioning rather than lecturing. Plato's Academy and Aristotle's Lyceum established models of structured education that influenced Western pedagogy for millennia.</p>
<p><strong>The Enlightenment</strong>: Jean-Jacques Rousseau's <em>Émile</em> (1762) argued that education should follow the natural development of the child, planting seeds for progressive education movements.</p>
<p><strong>19th–20th century</strong>: John Dewey championed experiential learning and democratic classrooms. Maria Montessori developed child-centered methods emphasizing self-directed activity. Paulo Freire's <em>Pedagogy of the Oppressed</em> (1970) reframed education as a tool for social liberation, critiquing the "banking model" where teachers deposit knowledge into passive students.</p>
<p><strong>21st century</strong>: Digital technology, learning analytics, and artificial intelligence are transforming pedagogy once again, enabling personalized learning at scale while raising new questions about equity, access, and the role of the human teacher.</p>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m1l1.id,
      title: 'Pedagogy Reflection Bot',
      type: 'chatbot',
      order: 1,
      chatbotTitle: 'Pedagogy Reflection Bot',
      chatbotIntro: 'Reflect on your own learning experiences with the help of this AI assistant. Think about the teachers who influenced you most and what made their teaching effective.',
      chatbotSystemPrompt: `You are a reflective pedagogy assistant embedded in a university course on pedagogy. Your role is to help students reflect on their own learning experiences and connect them to pedagogical concepts.

Guide students through reflections such as:
- Think about a teacher who had a significant impact on you. What did they do differently?
- Recall a time when you struggled to learn something. What eventually helped you understand?
- Consider how your own learning preferences have changed over time.

Ask one question at a time and build on the student's responses. Help them see connections between their personal experiences and the pedagogical theories covered in the course (e.g., constructivism, Socratic method, experiential learning). Be warm, curious, and encouraging. Never lecture—guide through questions.`,
      chatbotWelcome: "Welcome! Let's explore your own learning journey. Think back to your school years—can you recall a teacher who made a lasting impression on you? What was it about their teaching that stood out?",
    },
  });

  // Lecture 1.2: Learning Theories
  const c4m1l2 = await prisma.lecture.create({
    data: {
      moduleId: c4m1.id,
      title: 'Learning Theories: From Behaviorism to Constructivism',
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 30,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m1l2.id,
      title: 'Major Learning Theories',
      type: 'text',
      order: 0,
      content: `<h2>Major Learning Theories</h2>
<p>Learning theories provide frameworks for understanding how people acquire, process, and retain knowledge. Each theory offers different insights into the teaching-learning process, and effective educators draw from multiple traditions.</p>

<h3>1. Behaviorism</h3>
<p>Behaviorism focuses on <strong>observable behaviors</strong> and the environmental stimuli that shape them. Learning is defined as a change in behavior resulting from stimulus-response associations.</p>
<p><strong>Key thinkers</strong>:</p>
<ul>
<li><strong>Ivan Pavlov</strong> demonstrated classical conditioning—pairing a neutral stimulus with an unconditioned stimulus until the neutral stimulus alone elicits the response.</li>
<li><strong>B.F. Skinner</strong> developed operant conditioning—the idea that behavior is shaped by its consequences (reinforcement and punishment). Skinner's teaching machines were early precursors to computer-assisted instruction.</li>
</ul>
<p><strong>Classroom applications</strong>: Positive reinforcement, reward systems, drill-and-practice exercises, clear learning objectives with measurable outcomes, programmed instruction.</p>
<p><strong>Limitations</strong>: Behaviorism struggles to explain complex learning such as language acquisition, creativity, and critical thinking. It treats the learner as passive and ignores internal cognitive processes.</p>

<h3>2. Cognitivism</h3>
<p>Cognitivism shifts the focus to <strong>internal mental processes</strong>—how learners perceive, organize, store, and retrieve information. The mind is compared to a computer processing inputs and outputs.</p>
<p><strong>Key thinkers</strong>:</p>
<ul>
<li><strong>Jean Piaget</strong> described cognitive development in stages (sensorimotor, preoperational, concrete operational, formal operational), arguing that children actively construct understanding through interaction with their environment.</li>
<li><strong>Benjamin Bloom</strong> created a taxonomy of cognitive objectives—from lower-order thinking (remembering, understanding) to higher-order thinking (analyzing, evaluating, creating)—that remains foundational in instructional design.</li>
<li><strong>Jerome Bruner</strong> proposed discovery learning and the spiral curriculum, where concepts are revisited at increasing complexity.</li>
</ul>
<p><strong>Classroom applications</strong>: Concept mapping, scaffolded instruction, advance organizers, chunking information, metacognitive strategies (teaching students to think about their own thinking).</p>

<h3>3. Constructivism</h3>
<p>Constructivism holds that learners <strong>actively construct knowledge</strong> by building on prior experience. Knowledge is not transmitted from teacher to student but co-created through interaction with the environment and other people.</p>
<p><strong>Key thinkers</strong>:</p>
<ul>
<li><strong>Lev Vygotsky</strong> emphasized the social dimension of learning. His concept of the <em>Zone of Proximal Development</em> (ZPD) describes the gap between what a learner can do independently and what they can do with guidance. Effective teaching operates within this zone through <em>scaffolding</em>.</li>
<li><strong>John Dewey</strong> advocated learning by doing—authentic, hands-on experiences connected to real-world problems.</li>
</ul>
<p><strong>Classroom applications</strong>: Project-based learning, collaborative group work, case studies, inquiry-based learning, authentic assessments, Socratic seminars.</p>

<h3>4. Connectivism</h3>
<p>Proposed by <strong>George Siemens</strong> (2005), connectivism is the newest major learning theory, designed for the digital age. It argues that knowledge resides in <strong>networks</strong>—not just in individuals but distributed across people, organizations, and digital systems.</p>
<p><strong>Key principles</strong>:</p>
<ul>
<li>Learning is the process of connecting specialized nodes or information sources.</li>
<li>The capacity to know is more important than what is currently known.</li>
<li>Nurturing and maintaining connections is needed for continual learning.</li>
<li>Decision-making itself is a learning process—choosing what to learn and making sense of incoming information is as important as the information itself.</li>
</ul>
<p><strong>Classroom applications</strong>: Networked learning, use of social media and online communities, MOOCs, personal learning networks, digital portfolios.</p>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m1l2.id,
      title: 'Comparing the Theories',
      type: 'text',
      order: 1,
      content: `<h2>Comparing Learning Theories</h2>
<p>Each theory illuminates different aspects of learning. Rather than choosing one, skilled educators select the approach that best fits the context.</p>

<table>
<thead>
<tr><th>Dimension</th><th>Behaviorism</th><th>Cognitivism</th><th>Constructivism</th><th>Connectivism</th></tr>
</thead>
<tbody>
<tr><td><strong>View of learning</strong></td><td>Change in behavior</td><td>Information processing</td><td>Meaning-making</td><td>Network formation</td></tr>
<tr><td><strong>Role of teacher</strong></td><td>Director, reinforcer</td><td>Organizer, guide</td><td>Facilitator, co-learner</td><td>Curator, modeler</td></tr>
<tr><td><strong>Role of learner</strong></td><td>Passive recipient</td><td>Active processor</td><td>Active constructor</td><td>Network navigator</td></tr>
<tr><td><strong>Knowledge is…</strong></td><td>Objective, external</td><td>Structured schemas</td><td>Subjective, constructed</td><td>Distributed in networks</td></tr>
<tr><td><strong>Best for…</strong></td><td>Rote skills, procedures</td><td>Problem-solving, reasoning</td><td>Deep understanding, transfer</td><td>Rapidly evolving fields</td></tr>
<tr><td><strong>Assessment</strong></td><td>Observable performance</td><td>Tests, problem sets</td><td>Portfolios, projects</td><td>Network participation</td></tr>
</tbody>
</table>

<h3>When to Apply Each Theory</h3>
<p><strong>Use behaviorist approaches</strong> when teaching foundational skills that require automaticity—multiplication tables, surgical procedures, safety protocols. The goal is reliable, repeatable performance.</p>
<p><strong>Use cognitivist approaches</strong> when teaching complex problem-solving, analytical reasoning, or when students need to organize large bodies of information. Bloom's Taxonomy is invaluable here.</p>
<p><strong>Use constructivist approaches</strong> when the goal is deep understanding, transfer to new contexts, or development of critical thinking. This works well for ill-structured problems with no single right answer.</p>
<p><strong>Use connectivist approaches</strong> when learners need to navigate complex, rapidly changing information landscapes—for instance, staying current in technology, medicine, or policy fields.</p>

<h3>An Integrated Perspective</h3>
<p>In practice, a single course or even a single lesson may draw on multiple theories. A medical education program might use behaviorist drill for anatomy memorization, cognitivist frameworks for diagnostic reasoning, constructivist case studies for clinical judgment, and connectivist networks for staying current with research. The mark of pedagogical expertise is knowing which approach serves each learning goal.</p>`,
    },
  });

  // Quiz 1: Foundations of Pedagogy
  const c4q1 = await prisma.quiz.create({
    data: {
      courseId: course4.id,
      moduleId: c4m1.id,
      title: 'Foundations of Pedagogy Quiz',
      description: 'Test your understanding of the core concepts from Module 1.',
      instructions: 'Answer all questions. You may attempt this quiz up to 3 times. Your highest score will be recorded.',
      timeLimit: 20,
      maxAttempts: 3,
      passingScore: 70,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResults: 'after_submit',
      isPublished: true,
    },
  });

  const c4q1Questions = [
    {
      questionType: 'multiple_choice',
      questionText: 'What does the Greek word "paidagōgia" literally mean?',
      options: JSON.stringify(['The study of children', 'Leader of children', 'Teaching wisdom', 'Knowledge of youth']),
      correctAnswer: 'Leader of children',
      explanation: 'The Greek paidagōgia combines pais (child) and agōgos (leader), literally meaning "leader of children." The paidagōgos in ancient Greece was a slave who escorted children to school.',
      points: 1,
      orderIndex: 0,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'Which learning theorist is most closely associated with the Zone of Proximal Development (ZPD)?',
      options: JSON.stringify(['B.F. Skinner', 'Jean Piaget', 'Lev Vygotsky', 'Benjamin Bloom']),
      correctAnswer: 'Lev Vygotsky',
      explanation: 'Vygotsky introduced the ZPD to describe the gap between what a learner can do independently and what they can achieve with guidance. Scaffolding operates within this zone.',
      points: 1,
      orderIndex: 1,
    },
    {
      questionType: 'true_false',
      questionText: 'According to Malcolm Knowles, adult learners (andragogy) are primarily motivated by external rewards such as grades.',
      options: JSON.stringify(['True', 'False']),
      correctAnswer: 'False',
      explanation: 'Knowles argued that adult learners are motivated more by internal factors such as self-esteem, job satisfaction, and quality of life, rather than external motivators like grades.',
      points: 1,
      orderIndex: 2,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'Which learning theory views knowledge as distributed across networks of people, organizations, and digital systems?',
      options: JSON.stringify(['Behaviorism', 'Cognitivism', 'Constructivism', 'Connectivism']),
      correctAnswer: 'Connectivism',
      explanation: 'Connectivism, proposed by George Siemens, argues that learning in the digital age occurs through forming connections across distributed networks rather than solely within individuals.',
      points: 1,
      orderIndex: 3,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'Paulo Freire criticized what he called the "banking model" of education. What did he mean by this?',
      options: JSON.stringify([
        'Education should be funded like a bank',
        'Teachers deposit knowledge into passive students',
        'Students should save their knowledge for later use',
        'Learning is an economic transaction',
      ]),
      correctAnswer: 'Teachers deposit knowledge into passive students',
      explanation: 'Freire used the banking metaphor to critique traditional education where teachers "deposit" information into students who are treated as empty containers. He advocated instead for dialogical, liberating education.',
      points: 1,
      orderIndex: 4,
    },
    {
      questionType: 'true_false',
      questionText: 'Behaviorist approaches to teaching focus primarily on internal cognitive processes.',
      options: JSON.stringify(['True', 'False']),
      correctAnswer: 'False',
      explanation: 'Behaviorism focuses on observable behaviors and the external stimuli that shape them. It is cognitivism that focuses on internal mental processes.',
      points: 1,
      orderIndex: 5,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'Which theorist is credited with creating a taxonomy of cognitive objectives ranging from "Remember" to "Create"?',
      options: JSON.stringify(['Jerome Bruner', 'Benjamin Bloom', 'John Dewey', 'Maria Montessori']),
      correctAnswer: 'Benjamin Bloom',
      explanation: 'Benjamin Bloom developed the original taxonomy of educational objectives in 1956, later revised by Anderson and Krathwohl (2001) into the familiar six levels: Remember, Understand, Apply, Analyze, Evaluate, Create.',
      points: 1,
      orderIndex: 6,
    },
    {
      questionType: 'true_false',
      questionText: 'Constructivism holds that knowledge is objectively transmitted from teacher to student.',
      options: JSON.stringify(['True', 'False']),
      correctAnswer: 'False',
      explanation: 'Constructivism holds the opposite view: learners actively construct knowledge through interaction with their environment and prior experience. Knowledge is not passively transmitted but co-created.',
      points: 1,
      orderIndex: 7,
    },
  ];

  for (const q of c4q1Questions) {
    await prisma.quizQuestion.create({
      data: { quizId: c4q1.id, ...q },
    });
  }

  // Forum 1
  await prisma.forum.create({
    data: {
      courseId: course4.id,
      moduleId: c4m1.id,
      title: 'Discuss: Your Teaching Philosophy',
      description: 'Share your emerging teaching philosophy. What do you believe about how people learn best? What kind of teacher do you aspire to be? Draw on the learning theories discussed in this module to articulate your perspective. Respond to at least two classmates with thoughtful feedback.',
      isPublished: true,
      allowAnonymous: false,
      orderIndex: 0,
    },
  });

  // ---- Module 2: Instructional Design ----
  const c4m2 = await prisma.courseModule.create({
    data: {
      courseId: course4.id,
      title: 'Instructional Design',
      description: 'Learn to design effective learning experiences using established frameworks.',
      label: 'Week 2',
      orderIndex: 1,
      isPublished: true,
    },
  });

  // Lecture 2.1: Bloom's Taxonomy and Learning Objectives
  const c4m2l1 = await prisma.lecture.create({
    data: {
      moduleId: c4m2.id,
      title: "Bloom's Taxonomy and Learning Objectives",
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 25,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m2l1.id,
      title: "Bloom's Taxonomy",
      type: 'text',
      order: 0,
      content: `<h2>Bloom's Taxonomy: A Framework for Learning Objectives</h2>
<p>Benjamin Bloom and his colleagues published the <em>Taxonomy of Educational Objectives</em> in 1956, creating one of the most influential frameworks in education. The revised version (Anderson &amp; Krathwohl, 2001) organizes cognitive processes into six hierarchical levels.</p>

<h3>The Six Levels</h3>

<h4>1. Remember</h4>
<p>Retrieve relevant knowledge from long-term memory. This is the foundation—students must recall facts, terms, and basic concepts.</p>
<p><strong>Example</strong>: "List the four main learning theories discussed in Module 1."</p>

<h4>2. Understand</h4>
<p>Construct meaning from instructional messages. Students demonstrate understanding by interpreting, exemplifying, classifying, summarizing, comparing, or explaining.</p>
<p><strong>Example</strong>: "Explain the difference between behaviorism and constructivism in your own words."</p>

<h4>3. Apply</h4>
<p>Use a procedure in a given situation. This involves executing or implementing knowledge in new contexts.</p>
<p><strong>Example</strong>: "Given a classroom scenario, apply Vygotsky's Zone of Proximal Development to design an appropriate scaffolding strategy."</p>

<h4>4. Analyze</h4>
<p>Break material into constituent parts and determine how parts relate to each other and to an overall structure. Involves differentiating, organizing, and attributing.</p>
<p><strong>Example</strong>: "Analyze a lesson plan and identify which learning theory underlies each instructional activity."</p>

<h4>5. Evaluate</h4>
<p>Make judgments based on criteria and standards. Involves checking and critiquing.</p>
<p><strong>Example</strong>: "Evaluate the effectiveness of a flipped classroom approach for teaching introductory statistics, citing evidence from the literature."</p>

<h4>6. Create</h4>
<p>Put elements together to form a coherent whole or create an original product. This is the highest cognitive level, involving generating, planning, and producing.</p>
<p><strong>Example</strong>: "Design a complete lesson plan for teaching the scientific method to high school students using constructivist principles."</p>

<h3>Writing SMART Learning Objectives</h3>
<p>Effective learning objectives are <strong>SMART</strong>:</p>
<ul>
<li><strong>Specific</strong>: Clearly state what the student will be able to do.</li>
<li><strong>Measurable</strong>: Include an observable verb (avoid "understand" or "know"—use "explain," "compare," "design").</li>
<li><strong>Achievable</strong>: Realistic given the time, resources, and student level.</li>
<li><strong>Relevant</strong>: Aligned with course goals and student needs.</li>
<li><strong>Time-bound</strong>: Specify when the objective should be met (by end of lesson, week, or course).</li>
</ul>
<p><strong>Weak objective</strong>: "Students will understand learning theories."</p>
<p><strong>SMART objective</strong>: "By the end of Week 1, students will be able to compare and contrast three learning theories in a written response, citing at least one key thinker and one classroom application for each."</p>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m2l1.id,
      title: "Action Verbs by Bloom's Level",
      type: 'text',
      order: 1,
      content: `<h2>Action Verbs for Writing Learning Objectives</h2>
<p>The following table provides action verbs organized by Bloom's Taxonomy level. Use these verbs when writing learning objectives to ensure you are targeting the intended cognitive level.</p>

<table>
<thead>
<tr><th>Level</th><th>Action Verbs</th><th>Sample Objective Stem</th></tr>
</thead>
<tbody>
<tr><td><strong>Remember</strong></td><td>list, define, name, recall, identify, recognize, state, label, match</td><td>"Students will be able to list…"</td></tr>
<tr><td><strong>Understand</strong></td><td>explain, describe, summarize, paraphrase, classify, compare, interpret, discuss</td><td>"Students will be able to explain…"</td></tr>
<tr><td><strong>Apply</strong></td><td>apply, demonstrate, use, solve, implement, execute, calculate, illustrate</td><td>"Students will be able to apply…"</td></tr>
<tr><td><strong>Analyze</strong></td><td>analyze, differentiate, examine, categorize, deconstruct, compare, contrast, investigate</td><td>"Students will be able to analyze…"</td></tr>
<tr><td><strong>Evaluate</strong></td><td>evaluate, judge, justify, critique, assess, argue, defend, prioritize, recommend</td><td>"Students will be able to evaluate…"</td></tr>
<tr><td><strong>Create</strong></td><td>design, construct, develop, formulate, compose, produce, plan, propose, invent</td><td>"Students will be able to design…"</td></tr>
</tbody>
</table>

<h3>Common Mistakes in Writing Objectives</h3>
<ul>
<li><strong>"Understand" is not measurable</strong>—replace with "explain," "compare," or "summarize."</li>
<li><strong>"Know" is too vague</strong>—replace with "identify," "list," or "define."</li>
<li><strong>"Appreciate" is affective, not cognitive</strong>—if you want students to value something, consider using affective domain verbs and designing activities that build appreciation through experience.</li>
<li><strong>Too many objectives per lesson</strong>—focus on 2–4 well-crafted objectives rather than a long list.</li>
</ul>

<h3>Aligning Objectives, Activities, and Assessment</h3>
<p>The power of Bloom's Taxonomy lies in <strong>alignment</strong>. If your objective is at the "Analyze" level, your activities should give students practice in analysis, and your assessment should require analysis—not just recall. This principle of alignment (sometimes called <em>constructive alignment</em>, per John Biggs) is fundamental to effective instructional design.</p>`,
    },
  });

  // Lecture 2.2: Designing Effective Lesson Plans
  const c4m2l2 = await prisma.lecture.create({
    data: {
      moduleId: c4m2.id,
      title: 'Designing Effective Lesson Plans',
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 30,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m2l2.id,
      title: 'Lesson Plan Components',
      type: 'text',
      order: 0,
      content: `<h2>Anatomy of an Effective Lesson Plan</h2>
<p>A lesson plan is the teacher's roadmap—a detailed guide for what to teach, how to teach it, and how to know whether students learned. While formats vary, most effective lesson plans share core components.</p>

<h3>Essential Components</h3>

<h4>1. Learning Objectives</h4>
<p>Clear, measurable statements of what students will be able to do by the end of the lesson. These drive every other decision.</p>

<h4>2. Prior Knowledge Assessment</h4>
<p>How will you determine what students already know? Options include entry tickets, brief polls, KWL charts (Know–Want to know–Learned), or a short warm-up discussion.</p>

<h4>3. Instructional Activities</h4>
<p>The core of the lesson. Effective plans include a variety of activities that engage students actively:</p>
<ul>
<li><strong>Opening / Hook</strong> (5–10 min): Capture attention and activate prior knowledge. Use a provocative question, real-world example, brief video, or surprising fact.</li>
<li><strong>Direct Instruction</strong> (10–15 min): Present new content concisely. Keep lectures short—research shows attention drops after 10–15 minutes.</li>
<li><strong>Guided Practice</strong> (15–20 min): Students apply new knowledge with teacher support. Think-pair-share, worked examples, group problem-solving.</li>
<li><strong>Independent Practice</strong> (10–15 min): Students work on their own to consolidate learning.</li>
<li><strong>Closure</strong> (5–10 min): Summarize key points, check understanding, preview next lesson.</li>
</ul>

<h4>4. Assessment Strategy</h4>
<p>How will you know if students achieved the objectives? Include both:</p>
<ul>
<li><strong>Formative assessment</strong> (during the lesson): Exit tickets, thumbs up/down, brief quizzes, observation</li>
<li><strong>Summative assessment</strong> (at the end of a unit): Tests, projects, presentations</li>
</ul>

<h4>5. Materials and Resources</h4>
<p>Everything you need: slides, handouts, technology, physical materials, readings.</p>

<h4>6. Differentiation</h4>
<p>How will you accommodate diverse learners? Consider extensions for advanced students and scaffolds for struggling ones.</p>

<h4>7. Timing</h4>
<p>Realistic time allocations for each activity. Build in buffer time—activities often take longer than expected.</p>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m2l2.id,
      title: 'Backward Design',
      type: 'text',
      order: 1,
      content: `<h2>Backward Design: Understanding by Design</h2>
<p>Grant Wiggins and Jay McTighe introduced <strong>backward design</strong> (also called Understanding by Design or UbD) as a powerful alternative to traditional lesson planning. Instead of starting with activities ("What will we do in class?"), backward design starts with the end goal.</p>

<h3>The Three Stages</h3>

<h4>Stage 1: Identify Desired Results</h4>
<p>What should students understand and be able to do? Think about:</p>
<ul>
<li><strong>Enduring understandings</strong>: Big ideas that have lasting value beyond the classroom.</li>
<li><strong>Essential questions</strong>: Open-ended questions that provoke inquiry and spark discussion.</li>
<li><strong>Knowledge and skills</strong>: Specific facts, concepts, and procedures students need.</li>
</ul>
<p><strong>Example</strong>: Enduring understanding: "Effective teaching requires alignment between objectives, activities, and assessment." Essential question: "How do we design learning experiences that lead to genuine understanding?"</p>

<h4>Stage 2: Determine Acceptable Evidence</h4>
<p>Before planning activities, decide how you will know students have achieved the desired results. What evidence will demonstrate understanding?</p>
<ul>
<li><strong>Performance tasks</strong>: Authentic tasks that require students to apply learning (e.g., design a lesson plan, analyze a case study).</li>
<li><strong>Other evidence</strong>: Quizzes, reflections, observations, homework.</li>
</ul>
<p>This stage forces you to think about assessment as an integral part of design, not an afterthought.</p>

<h4>Stage 3: Plan Learning Experiences</h4>
<p>Only now do you plan the instructional activities. With clear goals (Stage 1) and assessment (Stage 2) in mind, you can design activities that genuinely prepare students to demonstrate understanding.</p>
<p>Wiggins and McTighe use the acronym <strong>WHERETO</strong> to guide activity planning:</p>
<ul>
<li><strong>W</strong>: Where is the unit going? What is expected?</li>
<li><strong>H</strong>: Hook students and hold their interest.</li>
<li><strong>E</strong>: Equip students with necessary experiences, tools, and knowledge.</li>
<li><strong>R</strong>: Provide opportunities to rethink, reflect, and revise.</li>
<li><strong>E</strong>: Allow students to evaluate their work and its implications.</li>
<li><strong>T</strong>: Be tailored to different learners' needs, interests, and abilities.</li>
<li><strong>O</strong>: Be organized to maximize deep understanding (not just coverage).</li>
</ul>

<h3>Sample Backward Design Walkthrough</h3>
<p><strong>Topic</strong>: Teaching the water cycle to 5th graders</p>
<p><strong>Stage 1</strong>: Students will understand that the water cycle is a continuous process driven by solar energy, and explain how human activity affects it. Essential question: "Where does our water come from, and where does it go?"</p>
<p><strong>Stage 2</strong>: Students will create a diagram of the water cycle with explanations of each stage, and write a one-paragraph response explaining one human impact on the water cycle.</p>
<p><strong>Stage 3</strong>: Hook with a mystery (where does rain come from?), hands-on evaporation experiment, interactive simulation, collaborative diagram creation, peer review, and individual reflection.</p>
<p>Notice how the assessment (Stage 2) directly connects to the understanding (Stage 1), and the activities (Stage 3) prepare students specifically for that assessment.</p>`,
    },
  });

  // Assignment: Design a Lesson Plan
  await prisma.assignment.create({
    data: {
      courseId: course4.id,
      moduleId: c4m2.id,
      title: 'Design a Lesson Plan',
      description: 'Apply backward design principles to create a complete lesson plan for a topic in your discipline.',
      instructions: `<h3>Assignment Overview</h3>
<p>Using the backward design framework (Wiggins &amp; McTighe), create a detailed lesson plan for a 50-minute class session on a topic of your choice in your field of study.</p>

<h3>Requirements</h3>
<ol>
<li><strong>Stage 1 – Desired Results</strong>:
<ul>
<li>2–3 SMART learning objectives (using Bloom's action verbs)</li>
<li>1 enduring understanding</li>
<li>1 essential question</li>
</ul></li>
<li><strong>Stage 2 – Assessment Evidence</strong>:
<ul>
<li>1 formative assessment strategy (during the lesson)</li>
<li>1 summative assessment (at the end or after the lesson)</li>
<li>Explain how each assessment aligns with your objectives</li>
</ul></li>
<li><strong>Stage 3 – Learning Plan</strong>:
<ul>
<li>Detailed timeline of activities with time allocations</li>
<li>Include at least one active learning strategy</li>
<li>Describe differentiation for diverse learners</li>
<li>List all materials and resources needed</li>
</ul></li>
<li><strong>Reflection</strong> (200–300 words): Explain which learning theory most influenced your design choices and why.</li>
</ol>

<h3>Submission</h3>
<p>Submit your lesson plan as a PDF or Word document. You may also include a text explanation in the submission box. Total length: 1000–1500 words.</p>`,
      submissionType: 'mixed',
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      points: 100,
      isPublished: true,
    },
  });

  // Code Lab 1: Analyzing Student Performance Data
  const c4lab1 = await prisma.codeLab.create({
    data: {
      moduleId: c4m2.id,
      title: 'Analyzing Student Performance Data',
      description: 'Use R to explore, summarize, and visualize student performance data. You will practice loading data, computing descriptive statistics, and creating visualizations commonly used in educational research.',
      orderIndex: 0,
      isPublished: true,
    },
  });

  await prisma.codeBlock.create({
    data: {
      codeLabId: c4lab1.id,
      title: 'Loading and Exploring Data',
      instructions: `In this block, you will create a sample dataset of student performance and explore its structure.

**Tasks:**
1. Create a data frame with 40 students, including columns for: student_id, group (A or B), pretest_score, posttest_score, and study_hours
2. Use \`head()\` to view the first few rows
3. Use \`summary()\` to get an overview of all variables
4. Use \`str()\` to examine the data types

Run the code and observe the output. What can you tell about the dataset from these functions?`,
      starterCode: `# Create sample student performance data
set.seed(42)  # For reproducibility

n <- 40
students <- data.frame(
  student_id = 1:n,
  group = rep(c("A", "B"), each = n/2),
  pretest_score = round(rnorm(n, mean = 50, sd = 12), 1),
  posttest_score = NA,  # We'll calculate this
  study_hours = round(runif(n, min = 2, max = 20), 1)
)

# Group A received traditional instruction, Group B received active learning
# Simulate posttest scores with group effect
students$posttest_score <- round(
  students$pretest_score +
  ifelse(students$group == "A", rnorm(n, 8, 5), rnorm(n, 15, 5)) +
  students$study_hours * 0.5,
  1
)

# Explore the data
head(students)
summary(students)
str(students)`,
      orderIndex: 0,
    },
  });

  await prisma.codeBlock.create({
    data: {
      codeLabId: c4lab1.id,
      title: 'Descriptive Statistics',
      instructions: `Now let's compute descriptive statistics to compare the two groups.

**Tasks:**
1. Calculate mean, median, and standard deviation of posttest scores for each group
2. Calculate the improvement (gain score) for each student
3. Compare the average improvement between groups

**Questions to consider:**
- Which group showed more improvement on average?
- How much variability is there within each group?
- Is the difference between groups practically meaningful?`,
      starterCode: `# Calculate descriptive statistics by group
library(dplyr)

group_stats <- students %>%
  group_by(group) %>%
  summarise(
    n = n(),
    mean_pretest = mean(pretest_score),
    mean_posttest = mean(posttest_score),
    sd_posttest = sd(posttest_score),
    median_posttest = median(posttest_score)
  )

print(group_stats)

# Calculate gain scores
students$gain <- students$posttest_score - students$pretest_score

gain_stats <- students %>%
  group_by(group) %>%
  summarise(
    mean_gain = mean(gain),
    sd_gain = sd(gain),
    min_gain = min(gain),
    max_gain = max(gain)
  )

print(gain_stats)

# Effect size (Cohen's d) for gain scores
group_a_gain <- students$gain[students$group == "A"]
group_b_gain <- students$gain[students$group == "B"]
pooled_sd <- sqrt((sd(group_a_gain)^2 + sd(group_b_gain)^2) / 2)
cohens_d <- (mean(group_b_gain) - mean(group_a_gain)) / pooled_sd
cat("Cohen's d:", round(cohens_d, 2), "\\n")`,
      orderIndex: 1,
    },
  });

  await prisma.codeBlock.create({
    data: {
      codeLabId: c4lab1.id,
      title: 'Visualizing Results',
      instructions: `Create visualizations to communicate your findings effectively.

**Tasks:**
1. Create a histogram of posttest scores
2. Create side-by-side boxplots comparing groups
3. Create a bar chart of mean gain scores by group with error bars

**Tips:**
- Use clear titles and axis labels
- Choose appropriate colors
- Think about which visualization tells the story most effectively`,
      starterCode: `library(ggplot2)

# 1. Histogram of posttest scores by group
ggplot(students, aes(x = posttest_score, fill = group)) +
  geom_histogram(bins = 12, alpha = 0.6, position = "identity") +
  labs(
    title = "Distribution of Posttest Scores by Group",
    x = "Posttest Score",
    y = "Count",
    fill = "Group"
  ) +
  scale_fill_manual(values = c("A" = "#e74c3c", "B" = "#3498db"),
                    labels = c("A" = "Traditional", "B" = "Active Learning")) +
  theme_minimal()

# 2. Boxplots comparing groups
ggplot(students, aes(x = group, y = posttest_score, fill = group)) +
  geom_boxplot(alpha = 0.7) +
  geom_jitter(width = 0.1, alpha = 0.4) +
  labs(
    title = "Posttest Scores: Traditional vs. Active Learning",
    x = "Instructional Method",
    y = "Posttest Score"
  ) +
  scale_x_discrete(labels = c("A" = "Traditional", "B" = "Active Learning")) +
  scale_fill_manual(values = c("A" = "#e74c3c", "B" = "#3498db")) +
  theme_minimal() +
  theme(legend.position = "none")

# 3. Bar chart of mean gain scores with error bars
gain_summary <- students %>%
  group_by(group) %>%
  summarise(
    mean_gain = mean(gain),
    se_gain = sd(gain) / sqrt(n())
  )

ggplot(gain_summary, aes(x = group, y = mean_gain, fill = group)) +
  geom_col(alpha = 0.8) +
  geom_errorbar(aes(ymin = mean_gain - se_gain, ymax = mean_gain + se_gain),
                width = 0.2) +
  labs(
    title = "Mean Score Improvement by Instructional Method",
    x = "Group",
    y = "Mean Gain Score (Post - Pre)"
  ) +
  scale_x_discrete(labels = c("A" = "Traditional", "B" = "Active Learning")) +
  scale_fill_manual(values = c("A" = "#e74c3c", "B" = "#3498db")) +
  theme_minimal() +
  theme(legend.position = "none")`,
      orderIndex: 2,
    },
  });

  // ---- Module 3: Teaching Strategies and Methods ----
  const c4m3 = await prisma.courseModule.create({
    data: {
      courseId: course4.id,
      title: 'Teaching Strategies and Methods',
      description: 'Explore evidence-based teaching strategies and assessment methods.',
      label: 'Week 3',
      orderIndex: 2,
      isPublished: true,
    },
  });

  // Lecture 3.1: Active Learning Strategies
  const c4m3l1 = await prisma.lecture.create({
    data: {
      moduleId: c4m3.id,
      title: 'Active Learning Strategies',
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 25,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m3l1.id,
      title: 'Active Learning Methods',
      type: 'text',
      order: 0,
      content: `<h2>Active Learning: Engaging Students Beyond the Lecture</h2>
<p>Active learning refers to any instructional method that engages students in the learning process beyond passive listening. Research consistently shows that active learning improves understanding, retention, and transfer. A landmark meta-analysis by Freeman et al. (2014) found that students in traditional lectures were 1.5 times more likely to fail than students in active learning environments.</p>

<h3>Key Active Learning Strategies</h3>

<h4>1. Think-Pair-Share</h4>
<p>The simplest and most versatile active learning technique:</p>
<ol>
<li><strong>Think</strong>: Pose a question; students think individually (1–2 min).</li>
<li><strong>Pair</strong>: Students discuss their ideas with a neighbor (2–3 min).</li>
<li><strong>Share</strong>: Pairs share insights with the whole class.</li>
</ol>
<p><strong>Why it works</strong>: Low stakes, forces individual processing before social discussion, gives every student a voice.</p>

<h4>2. Jigsaw</h4>
<p>Students become "experts" on one piece of a topic, then teach it to peers:</p>
<ol>
<li>Divide content into segments (e.g., 4 learning theories).</li>
<li>Assign each student to an "expert group" that studies one segment deeply.</li>
<li>Regroup so each new group has one expert per segment.</li>
<li>Experts teach their segment to the group.</li>
</ol>
<p><strong>Why it works</strong>: Teaching others is one of the most effective ways to learn. Creates positive interdependence—everyone needs everyone else.</p>

<h4>3. Flipped Classroom</h4>
<p>Students engage with content (readings, videos) before class, freeing class time for application, discussion, and practice:</p>
<ul>
<li><strong>Before class</strong>: Students watch a lecture video or read assigned material.</li>
<li><strong>During class</strong>: Instructor facilitates problem-solving, debates, case studies, and peer discussion.</li>
</ul>
<p><strong>Why it works</strong>: Moves passive content consumption out of precious class time. Students do the hardest cognitive work (application, analysis) when the instructor and peers are available to help.</p>

<h4>4. Problem-Based Learning (PBL)</h4>
<p>Students work in teams on complex, real-world problems with no single correct answer:</p>
<ul>
<li>The problem is presented first, before content instruction.</li>
<li>Students identify what they need to learn to solve the problem.</li>
<li>Students research, discuss, and propose solutions.</li>
<li>The instructor facilitates rather than lectures.</li>
</ul>
<p><strong>Why it works</strong>: Develops critical thinking, collaboration, and self-directed learning. Knowledge is learned in context, improving transfer.</p>

<h4>5. Case Studies</h4>
<p>Present a detailed scenario (real or fictional) and ask students to analyze it, make decisions, or solve problems. Cases are particularly powerful in professional fields (medicine, business, law, education) because they bridge theory and practice.</p>

<h3>Implementation Tips</h3>
<ul>
<li><strong>Start small</strong>: Add one active learning technique to an existing lecture before redesigning everything.</li>
<li><strong>Explain the why</strong>: Students may resist if they're used to passive lectures. Explain the research behind active learning.</li>
<li><strong>Manage time carefully</strong>: Active learning can take longer than expected. Be prepared to adjust.</li>
<li><strong>Debrief</strong>: Always follow activities with a whole-class discussion to consolidate learning and address misconceptions.</li>
</ul>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m3l1.id,
      title: 'Active Learning Advisor',
      type: 'chatbot',
      order: 1,
      chatbotTitle: 'Active Learning Advisor',
      chatbotIntro: 'This AI assistant helps you design an active learning activity for a topic of your choice. Tell it what you are teaching, and it will guide you through selecting and adapting an appropriate strategy.',
      chatbotSystemPrompt: `You are an Active Learning Advisor embedded in a university pedagogy course. Your role is to help students (who are often pre-service or in-service teachers) design active learning activities for their own teaching contexts.

When a student provides a topic they want to teach:
1. Ask about the context: What level are the learners? How many students? How much time?
2. Suggest 2-3 active learning strategies that would fit, briefly explaining why each might work
3. Help them develop one strategy in detail: step-by-step plan, timing, materials needed
4. Anticipate challenges and suggest solutions
5. Help them think about how to assess learning during the activity

Be practical and specific. Give concrete examples, not abstract advice. If the student's idea needs refinement, suggest improvements respectfully. Draw on strategies discussed in the course: Think-Pair-Share, Jigsaw, Flipped Classroom, PBL, Case Studies.`,
      chatbotWelcome: "Hi! I'm here to help you design an active learning activity. What topic do you want to teach, and who are your learners? Tell me a bit about your context and I'll help you find the right approach.",
    },
  });

  // Lecture 3.2: Assessment and Feedback
  const c4m3l2 = await prisma.lecture.create({
    data: {
      moduleId: c4m3.id,
      title: 'Assessment and Feedback',
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 30,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m3l2.id,
      title: 'Assessment Methods',
      type: 'text',
      order: 0,
      content: `<h2>Assessment: Measuring and Supporting Learning</h2>
<p>Assessment is not merely the end of instruction—it is woven throughout the teaching and learning process. Effective assessment serves multiple purposes: diagnosing prior knowledge, monitoring progress, providing feedback, and certifying achievement.</p>

<h3>Formative vs. Summative Assessment</h3>

<h4>Formative Assessment (Assessment FOR Learning)</h4>
<p>Ongoing assessment during instruction that provides information to guide teaching and learning. The goal is to identify gaps and misconceptions while there is still time to address them.</p>
<p><strong>Examples</strong>:</p>
<ul>
<li><strong>Exit tickets</strong>: Students answer 1–2 questions before leaving class. "What was the most important thing you learned today? What is still unclear?"</li>
<li><strong>Muddiest point</strong>: Students write down the concept they found most confusing.</li>
<li><strong>Polls and clickers</strong>: Real-time concept checks during a lecture.</li>
<li><strong>Think-alouds</strong>: Students verbalize their reasoning process while solving a problem.</li>
<li><strong>Draft feedback</strong>: Comments on work-in-progress before final submission.</li>
</ul>

<h4>Summative Assessment (Assessment OF Learning)</h4>
<p>Assessment at the end of an instructional period to evaluate what students have learned. Typically carries a grade.</p>
<p><strong>Examples</strong>:</p>
<ul>
<li>Final exams, midterm exams</li>
<li>Term papers and research projects</li>
<li>Portfolios</li>
<li>Capstone presentations</li>
</ul>

<h3>Designing Effective Rubrics</h3>
<p>Rubrics provide transparent criteria for assessment, helping students understand expectations and enabling consistent grading.</p>
<p><strong>Components of a rubric</strong>:</p>
<ul>
<li><strong>Criteria</strong>: What dimensions of performance are assessed (e.g., argument quality, use of evidence, writing clarity)?</li>
<li><strong>Performance levels</strong>: Categories of quality (e.g., Excellent / Proficient / Developing / Beginning).</li>
<li><strong>Descriptors</strong>: Specific descriptions of what each performance level looks like for each criterion.</li>
</ul>
<p><strong>Tip</strong>: Share rubrics with students <em>before</em> they begin an assignment. This transforms the rubric from a grading tool into a learning tool.</p>

<h3>Authentic Assessment</h3>
<p>Authentic assessments ask students to perform real-world tasks that demonstrate meaningful application of knowledge and skills.</p>
<ul>
<li>Instead of a multiple-choice test on lesson planning, have students <strong>design an actual lesson plan</strong>.</li>
<li>Instead of a quiz on research methods, have students <strong>conduct a mini-research study</strong>.</li>
<li>Instead of a test on pedagogy theories, have students <strong>observe a class and analyze the teaching strategies used</strong>.</li>
</ul>

<h3>Effective Feedback Strategies</h3>
<p>Feedback is most powerful when it is:</p>
<ul>
<li><strong>Timely</strong>: Given while the learning experience is fresh.</li>
<li><strong>Specific</strong>: Points to exact areas for improvement, not just "good job" or "needs work."</li>
<li><strong>Actionable</strong>: Tells the student what to do next, not just what's wrong.</li>
<li><strong>Balanced</strong>: Acknowledges strengths alongside areas for growth.</li>
<li><strong>Forward-looking</strong>: Focused on future improvement rather than justifying a grade.</li>
</ul>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m3l2.id,
      title: "Assessment by Bloom's Level",
      type: 'text',
      order: 1,
      content: `<h2>Assessment Methods by Bloom's Taxonomy Level</h2>
<p>Aligning your assessment method to the cognitive level you intend to measure is crucial. Here are appropriate assessment strategies for each level of Bloom's Taxonomy.</p>

<table>
<thead>
<tr><th>Bloom's Level</th><th>What You're Measuring</th><th>Appropriate Assessment Methods</th></tr>
</thead>
<tbody>
<tr><td><strong>Remember</strong></td><td>Recall of facts and terms</td><td>Multiple-choice, fill-in-the-blank, matching, flashcard quizzes, labeling diagrams</td></tr>
<tr><td><strong>Understand</strong></td><td>Comprehension of concepts</td><td>Short-answer explanations, concept maps, "explain in your own words," summarize a reading</td></tr>
<tr><td><strong>Apply</strong></td><td>Using knowledge in new situations</td><td>Problem sets, case study analysis, simulations, role plays, worked examples</td></tr>
<tr><td><strong>Analyze</strong></td><td>Breaking down and examining</td><td>Compare-and-contrast essays, data analysis tasks, debate preparation, identifying assumptions in an argument</td></tr>
<tr><td><strong>Evaluate</strong></td><td>Making judgments</td><td>Peer review, critique of an article, justification essays, proposal evaluation, defense of a position</td></tr>
<tr><td><strong>Create</strong></td><td>Producing something new</td><td>Design projects, research proposals, lesson plans, original experiments, portfolios, creative works</td></tr>
</tbody>
</table>

<h3>Common Alignment Errors</h3>
<ul>
<li><strong>Mismatch between objective and test</strong>: Teaching at the "Analyze" level but testing at "Remember" (e.g., teaching critical thinking but giving a multiple-choice recall test).</li>
<li><strong>Over-reliance on one method</strong>: Using only multiple-choice tests, which primarily measure Remember and Understand levels.</li>
<li><strong>Assessing what's easy to measure</strong>: Defaulting to factual recall because it's easy to grade, rather than measuring the deeper learning you actually value.</li>
</ul>

<h3>Practical Guideline</h3>
<p>For most courses, aim for a mix of assessments across Bloom's levels. A well-designed assessment portfolio might include:</p>
<ul>
<li>A quiz covering key terms and concepts (Remember, Understand)</li>
<li>A problem-solving assignment (Apply, Analyze)</li>
<li>A project or paper requiring synthesis and original thinking (Evaluate, Create)</li>
<li>Ongoing formative assessments to monitor progress at all levels</li>
</ul>`,
    },
  });

  // Quiz 2: Teaching Strategies
  const c4q2 = await prisma.quiz.create({
    data: {
      courseId: course4.id,
      moduleId: c4m3.id,
      title: 'Teaching Strategies Quiz',
      description: 'Test your understanding of active learning strategies and assessment methods.',
      instructions: 'Answer all questions. You may attempt this quiz up to 3 times.',
      timeLimit: 25,
      maxAttempts: 3,
      passingScore: 70,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResults: 'after_submit',
      isPublished: true,
    },
  });

  const c4q2Questions = [
    {
      questionType: 'multiple_choice',
      questionText: 'According to the meta-analysis by Freeman et al. (2014), students in traditional lectures were how many times more likely to fail compared to active learning students?',
      options: JSON.stringify(['1.2 times', '1.5 times', '2.0 times', '2.5 times']),
      correctAnswer: '1.5 times',
      explanation: 'Freeman et al. (2014) conducted a landmark meta-analysis of 225 studies and found that students in traditional lectures were 1.5 times more likely to fail compared to those in active learning environments.',
      points: 1,
      orderIndex: 0,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'In the Jigsaw method, what is the primary learning mechanism?',
      options: JSON.stringify([
        'Students compete to answer questions fastest',
        'Students become experts on one segment and teach it to peers',
        'The instructor breaks down content into smaller pieces',
        'Students work through a puzzle-like problem set',
      ]),
      correctAnswer: 'Students become experts on one segment and teach it to peers',
      explanation: 'In Jigsaw, each student becomes an expert on one piece of the content and then teaches it to their peers. The act of teaching deepens learning and creates positive interdependence.',
      points: 1,
      orderIndex: 1,
    },
    {
      questionType: 'true_false',
      questionText: 'In a flipped classroom model, students engage with new content during class time and practice at home.',
      options: JSON.stringify(['True', 'False']),
      correctAnswer: 'False',
      explanation: 'In a flipped classroom, students engage with content (videos, readings) BEFORE class, and class time is used for application, practice, discussion, and problem-solving with instructor support.',
      points: 1,
      orderIndex: 2,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'Which of the following is an example of formative assessment?',
      options: JSON.stringify(['Final exam', 'Exit ticket', 'Term paper', 'Capstone presentation']),
      correctAnswer: 'Exit ticket',
      explanation: 'Exit tickets are a formative assessment—quick checks during or at the end of a lesson that provide immediate feedback on student understanding. The other options are summative assessments.',
      points: 1,
      orderIndex: 3,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'What is the key characteristic of "authentic assessment"?',
      options: JSON.stringify([
        'It is always timed',
        'It asks students to perform real-world tasks',
        'It is graded on a curve',
        'It uses only multiple-choice questions',
      ]),
      correctAnswer: 'It asks students to perform real-world tasks',
      explanation: 'Authentic assessment requires students to apply knowledge and skills to realistic tasks or scenarios, demonstrating meaningful application rather than just recall.',
      points: 1,
      orderIndex: 4,
    },
    {
      questionType: 'true_false',
      questionText: 'Rubrics should only be shared with students after they submit their work.',
      options: JSON.stringify(['True', 'False']),
      correctAnswer: 'False',
      explanation: 'Rubrics should be shared BEFORE students begin an assignment. This transforms the rubric from a grading tool into a learning tool, helping students understand expectations and self-assess their work.',
      points: 1,
      orderIndex: 5,
    },
    {
      questionType: 'multiple_choice',
      questionText: "Which assessment method is MOST appropriate for measuring \"Analyze\" level thinking in Bloom's Taxonomy?",
      options: JSON.stringify([
        'Multiple-choice quiz on definitions',
        'Fill-in-the-blank vocabulary test',
        'Compare-and-contrast essay',
        'Labeling a diagram',
      ]),
      correctAnswer: 'Compare-and-contrast essay',
      explanation: 'Compare-and-contrast tasks require students to break down information, identify relationships, and examine how parts relate—all hallmarks of analysis. The other options primarily measure Remember level.',
      points: 1,
      orderIndex: 6,
    },
    {
      questionType: 'short_answer',
      questionText: 'Name one of the three steps in the Think-Pair-Share technique.',
      correctAnswer: 'Think',
      explanation: 'The three steps are Think (individual reflection), Pair (discuss with a partner), and Share (report to the class). Any one of these is correct.',
      points: 1,
      orderIndex: 7,
    },
    {
      questionType: 'multiple_choice',
      questionText: 'According to the lecture, effective feedback should be all of the following EXCEPT:',
      options: JSON.stringify(['Timely', 'Specific', 'Comparative to other students', 'Actionable']),
      correctAnswer: 'Comparative to other students',
      explanation: 'Effective feedback should be timely, specific, actionable, balanced, and forward-looking. Comparing students to each other is not a characteristic of good feedback—it can be demotivating and unhelpful.',
      points: 1,
      orderIndex: 8,
    },
    {
      questionType: 'true_false',
      questionText: 'Problem-Based Learning (PBL) always begins with content instruction before presenting the problem.',
      options: JSON.stringify(['True', 'False']),
      correctAnswer: 'False',
      explanation: 'A defining feature of PBL is that the problem is presented FIRST, before content instruction. Students identify what they need to learn in order to solve the problem, which drives self-directed learning.',
      points: 1,
      orderIndex: 9,
    },
  ];

  for (const q of c4q2Questions) {
    await prisma.quizQuestion.create({
      data: { quizId: c4q2.id, ...q },
    });
  }

  // Code Lab 2: Survey Data Analysis
  const c4lab2 = await prisma.codeLab.create({
    data: {
      moduleId: c4m3.id,
      title: 'Survey Data Analysis for Teaching Evaluation',
      description: 'Learn to analyze Likert-scale survey data commonly used in teaching evaluations. You will create survey data, compute frequency tables, create visualizations, and explore correlations between teaching factors.',
      orderIndex: 0,
      isPublished: true,
    },
  });

  await prisma.codeBlock.create({
    data: {
      codeLabId: c4lab2.id,
      title: 'Creating Survey Data',
      instructions: `In this block, you will create a simulated teaching evaluation dataset with Likert-scale responses.

**Tasks:**
1. Create a data frame simulating 60 student responses to a teaching evaluation
2. Include items measuring: clarity, engagement, feedback_quality, and overall_satisfaction
3. Convert responses to ordered factors (Strongly Disagree to Strongly Agree)
4. Examine the structure and summary of the data

**Note:** In real research, you would import actual survey data. Here we simulate it to practice the analysis techniques.`,
      starterCode: `# Create simulated teaching evaluation data
set.seed(123)

n <- 60
likert_levels <- c("Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree")

# Simulate responses (higher scores for clarity and engagement)
survey <- data.frame(
  respondent_id = 1:n,
  clarity = sample(likert_levels, n, replace = TRUE,
                   prob = c(0.05, 0.10, 0.20, 0.35, 0.30)),
  engagement = sample(likert_levels, n, replace = TRUE,
                      prob = c(0.03, 0.08, 0.15, 0.40, 0.34)),
  feedback_quality = sample(likert_levels, n, replace = TRUE,
                            prob = c(0.08, 0.15, 0.30, 0.30, 0.17)),
  overall_satisfaction = sample(likert_levels, n, replace = TRUE,
                                prob = c(0.05, 0.10, 0.20, 0.35, 0.30))
)

# Convert to ordered factors
for (col in c("clarity", "engagement", "feedback_quality", "overall_satisfaction")) {
  survey[[col]] <- factor(survey[[col]], levels = likert_levels, ordered = TRUE)
}

# Examine the data
str(survey)
summary(survey)`,
      orderIndex: 0,
    },
  });

  await prisma.codeBlock.create({
    data: {
      codeLabId: c4lab2.id,
      title: 'Analyzing Likert Responses',
      instructions: `Now let's create frequency tables and visualizations for the Likert responses.

**Tasks:**
1. Create frequency tables for each survey item
2. Calculate the percentage of positive responses (Agree + Strongly Agree)
3. Create a stacked bar chart showing the distribution of responses across all items

**Questions to consider:**
- Which aspect of teaching received the highest ratings?
- Which aspect has the most room for improvement?`,
      starterCode: `library(ggplot2)
library(tidyr)
library(dplyr)

# Frequency tables
for (col in c("clarity", "engagement", "feedback_quality", "overall_satisfaction")) {
  cat("\\n---", col, "---\\n")
  tbl <- table(survey[[col]])
  print(tbl)
  cat("Positive (%):", round(sum(tbl[c("Agree", "Strongly Agree")]) / sum(tbl) * 100, 1), "\\n")
}

# Reshape data for visualization
survey_long <- survey %>%
  pivot_longer(cols = -respondent_id, names_to = "item", values_to = "response")

# Stacked bar chart
ggplot(survey_long, aes(x = item, fill = response)) +
  geom_bar(position = "fill") +
  scale_fill_manual(values = c(
    "Strongly Disagree" = "#d73027",
    "Disagree" = "#fc8d59",
    "Neutral" = "#ffffbf",
    "Agree" = "#91bfdb",
    "Strongly Agree" = "#4575b4"
  )) +
  scale_y_continuous(labels = scales::percent) +
  labs(
    title = "Teaching Evaluation Results",
    x = "Survey Item",
    y = "Percentage of Responses",
    fill = "Response"
  ) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))`,
      orderIndex: 1,
    },
  });

  await prisma.codeBlock.create({
    data: {
      codeLabId: c4lab2.id,
      title: 'Correlation Analysis',
      instructions: `Explore relationships between different teaching evaluation dimensions.

**Tasks:**
1. Convert Likert responses to numeric values for correlation analysis
2. Compute a correlation matrix
3. Create scatterplots to visualize key relationships
4. Interpret the correlations: which teaching factors are most strongly associated with overall satisfaction?

**Important note:** Remember that correlation does not imply causation. We can observe associations but cannot conclude that one factor causes another.`,
      starterCode: `library(ggplot2)

# Convert factors to numeric for correlation analysis
survey_numeric <- data.frame(
  clarity = as.numeric(survey$clarity),
  engagement = as.numeric(survey$engagement),
  feedback_quality = as.numeric(survey$feedback_quality),
  overall_satisfaction = as.numeric(survey$overall_satisfaction)
)

# Correlation matrix
cor_matrix <- cor(survey_numeric, method = "spearman")
cat("Spearman Correlation Matrix:\\n")
print(round(cor_matrix, 3))

# Visualize correlations with scatterplots
# Engagement vs Overall Satisfaction
ggplot(survey_numeric, aes(x = engagement, y = overall_satisfaction)) +
  geom_jitter(width = 0.15, height = 0.15, alpha = 0.5, color = "#3498db") +
  geom_smooth(method = "lm", se = TRUE, color = "#e74c3c") +
  labs(
    title = "Engagement vs. Overall Satisfaction",
    subtitle = paste("Spearman r =", round(cor_matrix["engagement", "overall_satisfaction"], 3)),
    x = "Engagement (1=SD, 5=SA)",
    y = "Overall Satisfaction (1=SD, 5=SA)"
  ) +
  theme_minimal()

# Feedback Quality vs Overall Satisfaction
ggplot(survey_numeric, aes(x = feedback_quality, y = overall_satisfaction)) +
  geom_jitter(width = 0.15, height = 0.15, alpha = 0.5, color = "#2ecc71") +
  geom_smooth(method = "lm", se = TRUE, color = "#e74c3c") +
  labs(
    title = "Feedback Quality vs. Overall Satisfaction",
    subtitle = paste("Spearman r =", round(cor_matrix["feedback_quality", "overall_satisfaction"], 3)),
    x = "Feedback Quality (1=SD, 5=SA)",
    y = "Overall Satisfaction (1=SD, 5=SA)"
  ) +
  theme_minimal()`,
      orderIndex: 2,
    },
  });

  // ---- Module 4: Technology-Enhanced Learning ----
  const c4m4 = await prisma.courseModule.create({
    data: {
      courseId: course4.id,
      title: 'Technology-Enhanced Learning',
      description: 'Explore how technology and AI are transforming education.',
      label: 'Week 4',
      orderIndex: 3,
      isPublished: true,
    },
  });

  // Lecture 4.1: Integrating Technology in Education
  const c4m4l1 = await prisma.lecture.create({
    data: {
      moduleId: c4m4.id,
      title: 'Integrating Technology in Education',
      contentType: 'text',
      orderIndex: 0,
      isPublished: true,
      duration: 25,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m4l1.id,
      title: 'Frameworks for Technology Integration',
      type: 'text',
      order: 0,
      content: `<h2>Frameworks for Technology Integration in Education</h2>
<p>Technology can transform teaching and learning—but only when integrated thoughtfully. Dropping technology into a classroom without pedagogical purpose often produces disappointing results. Two frameworks help educators think systematically about technology integration.</p>

<h3>The SAMR Model</h3>
<p>Developed by Ruben Puentedura, the SAMR model describes four levels of technology integration, from simple substitution to fundamental transformation:</p>

<h4>Substitution</h4>
<p>Technology acts as a direct substitute with no functional change. The task is the same; only the tool changes.</p>
<p><strong>Example</strong>: Students type an essay in Google Docs instead of writing it by hand.</p>

<h4>Augmentation</h4>
<p>Technology acts as a direct substitute with functional improvement. The task is essentially the same, but technology adds capabilities.</p>
<p><strong>Example</strong>: Students write an essay in Google Docs and use the spell-checker, word count, and commenting features.</p>

<h4>Modification</h4>
<p>Technology allows for significant task redesign. The nature of the task changes because of what technology makes possible.</p>
<p><strong>Example</strong>: Students collaboratively write an essay in Google Docs in real time, commenting on and editing each other's work synchronously.</p>

<h4>Redefinition</h4>
<p>Technology allows for the creation of new tasks that were previously inconceivable.</p>
<p><strong>Example</strong>: Students create a multimedia documentary combining text, video interviews, data visualizations, and interactive elements, then publish it to a global audience for feedback.</p>

<h3>The TPACK Framework</h3>
<p>TPACK (Technological Pedagogical Content Knowledge) identifies three types of knowledge teachers need and their intersections:</p>
<ul>
<li><strong>Content Knowledge (CK)</strong>: Deep understanding of the subject matter.</li>
<li><strong>Pedagogical Knowledge (PK)</strong>: Understanding of teaching methods, assessment, and learning theories.</li>
<li><strong>Technological Knowledge (TK)</strong>: Understanding of available technologies and their capabilities.</li>
</ul>
<p>Effective technology integration occurs at the intersection of all three:</p>
<ul>
<li><strong>TPK</strong> (Technological Pedagogical Knowledge): Knowing which technologies support specific teaching strategies.</li>
<li><strong>TCK</strong> (Technological Content Knowledge): Understanding how technology represents and transforms content.</li>
<li><strong>TPACK</strong>: The sweet spot—knowing how to use specific technologies to teach specific content effectively.</li>
</ul>

<h3>Digital Literacy for Educators</h3>
<p>Beyond specific tools, educators need broader digital literacy skills:</p>
<ul>
<li><strong>Information literacy</strong>: Evaluating the quality and reliability of digital sources.</li>
<li><strong>Data literacy</strong>: Understanding and interpreting data, including learning analytics.</li>
<li><strong>Digital citizenship</strong>: Modeling responsible, ethical, and safe use of technology.</li>
<li><strong>Privacy awareness</strong>: Understanding data privacy implications of educational technology.</li>
</ul>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m4l1.id,
      title: 'SAMR Examples in Practice',
      type: 'text',
      order: 1,
      content: `<h2>Technology Integration at Each SAMR Level</h2>
<p>The following examples illustrate how the same learning goal can be approached at different SAMR levels.</p>

<h3>Example: Teaching Literature Analysis</h3>
<table>
<thead>
<tr><th>SAMR Level</th><th>Activity</th><th>Technology Used</th></tr>
</thead>
<tbody>
<tr><td><strong>Substitution</strong></td><td>Students read the novel as an e-book instead of a physical book</td><td>E-reader / PDF</td></tr>
<tr><td><strong>Augmentation</strong></td><td>Students annotate the e-book with highlights and notes, use dictionary lookup for unfamiliar words</td><td>Kindle / annotated PDF</td></tr>
<tr><td><strong>Modification</strong></td><td>Students create a shared annotation layer where the whole class discusses passages collaboratively</td><td>Hypothes.is / Perusall</td></tr>
<tr><td><strong>Redefinition</strong></td><td>Students collaborate with a class in another country to compare cultural interpretations of the same text, using video conferencing and shared digital workspaces</td><td>Zoom + Google Docs + discussion boards</td></tr>
</tbody>
</table>

<h3>Example: Teaching Data Analysis</h3>
<table>
<thead>
<tr><th>SAMR Level</th><th>Activity</th><th>Technology Used</th></tr>
</thead>
<tbody>
<tr><td><strong>Substitution</strong></td><td>Students use a calculator app instead of a physical calculator</td><td>Calculator app</td></tr>
<tr><td><strong>Augmentation</strong></td><td>Students use a spreadsheet to calculate statistics, seeing formulas and results update instantly</td><td>Excel / Google Sheets</td></tr>
<tr><td><strong>Modification</strong></td><td>Students write R code to analyze real-world datasets, visualize results, and iterate on their analysis</td><td>R / RStudio</td></tr>
<tr><td><strong>Redefinition</strong></td><td>Students access live public datasets (census data, climate data), perform original analyses, and publish interactive dashboards for community stakeholders</td><td>R + Shiny / Tableau Public</td></tr>
</tbody>
</table>

<h3>Important Considerations</h3>
<ul>
<li><strong>Higher is not always better</strong>: Substitution is perfectly appropriate when the learning goal doesn't require transformation. Not every lesson needs to be at the Redefinition level.</li>
<li><strong>Start where you are</strong>: If you're new to technology integration, begin with Substitution and Augmentation, then gradually move toward Modification and Redefinition.</li>
<li><strong>Pedagogy first</strong>: Always start with the learning objective. Ask "What do I want students to learn?" before "What technology should I use?"</li>
<li><strong>Equity matters</strong>: Ensure all students have equitable access to the required technology. A beautifully designed tech-rich activity is useless if some students can't participate.</li>
</ul>`,
    },
  });

  // Lecture 4.2: AI as a Teaching and Learning Tool
  const c4m4l2 = await prisma.lecture.create({
    data: {
      moduleId: c4m4.id,
      title: 'AI as a Teaching and Learning Tool',
      contentType: 'text',
      orderIndex: 1,
      isPublished: true,
      duration: 30,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m4l2.id,
      title: 'AI in Education',
      type: 'text',
      order: 0,
      content: `<h2>AI in Education: Current Applications and Future Directions</h2>
<p>Artificial intelligence is reshaping education in profound ways—from personalized tutoring systems to automated assessment and curriculum design. Understanding these applications is essential for modern educators.</p>

<h3>AI Tutoring Systems</h3>
<p>AI tutors can provide one-on-one guidance at scale, something no human instructor can do for hundreds of students simultaneously. Modern AI tutoring systems:</p>
<ul>
<li><strong>Adapt to individual pace</strong>: Adjusting difficulty and content based on student performance in real time.</li>
<li><strong>Provide immediate feedback</strong>: Students don't have to wait days for a response—they get help exactly when they need it.</li>
<li><strong>Identify knowledge gaps</strong>: By analyzing patterns in student responses, AI can pinpoint specific misconceptions.</li>
<li><strong>Offer multiple explanations</strong>: If one explanation doesn't work, AI can try a different approach—analogies, examples, visual representations.</li>
</ul>
<p><strong>Examples</strong>: Khan Academy's AI tutor (Khanmigo), Carnegie Learning's MATHia, LAILA's own collaborative tutoring module.</p>

<h3>Adaptive Learning</h3>
<p>Adaptive learning systems use algorithms to customize the learning path for each student:</p>
<ul>
<li><strong>Pre-assessment</strong>: Determine what the student already knows.</li>
<li><strong>Personalized pathway</strong>: Skip content the student has mastered; spend more time on areas of difficulty.</li>
<li><strong>Continuous adjustment</strong>: As the student progresses, the system refines its model of their knowledge.</li>
</ul>
<p>This approach can dramatically improve efficiency—students don't waste time on material they've already mastered.</p>

<h3>Automated Feedback and Assessment</h3>
<p>AI can provide rapid feedback on various types of student work:</p>
<ul>
<li><strong>Writing</strong>: Grammar correction, style suggestions, argument structure analysis.</li>
<li><strong>Code</strong>: Syntax checking, bug identification, code quality feedback.</li>
<li><strong>Math</strong>: Step-by-step solution checking, identification of where reasoning went wrong.</li>
<li><strong>Presentations</strong>: Analysis of pacing, clarity, and content coverage.</li>
</ul>
<p><strong>Important</strong>: AI feedback should supplement, not replace, human feedback. The relational and motivational dimensions of feedback—empathy, encouragement, nuanced understanding of a student's journey—remain uniquely human strengths.</p>

<h3>Ethical Considerations</h3>
<p>The integration of AI in education raises important ethical questions:</p>
<ul>
<li><strong>Data privacy</strong>: AI systems collect vast amounts of student data. Who owns this data? How is it protected? Can it be used against students?</li>
<li><strong>Bias</strong>: AI systems can perpetuate or amplify existing biases in educational content, assessment, and recommendations.</li>
<li><strong>Equity</strong>: Will AI widen the gap between well-resourced and under-resourced schools?</li>
<li><strong>Academic integrity</strong>: How do we design assessments that are meaningful when students have access to AI tools?</li>
<li><strong>Human connection</strong>: Does increased AI use reduce the human relationships that are central to effective education?</li>
<li><strong>Over-reliance</strong>: Will students (and teachers) become dependent on AI, atrophying skills they need?</li>
</ul>`,
    },
  });

  await prisma.lectureSection.create({
    data: {
      lectureId: c4m4l2.id,
      title: 'AI Ethics Discussion Bot',
      type: 'chatbot',
      order: 1,
      chatbotTitle: 'AI Ethics Discussion Bot',
      chatbotIntro: 'Engage in a structured discussion about the ethical implications of using AI in education. This bot will challenge you to think critically about both the benefits and risks.',
      chatbotSystemPrompt: `You are an AI Ethics Discussion facilitator in a university pedagogy course. Your role is to guide students through a thoughtful exploration of ethical issues related to AI in education.

Your approach:
1. Start by asking the student to identify one benefit and one concern about AI in education.
2. For any benefit they mention, gently push them to consider potential downsides.
3. For any concern they raise, acknowledge it and explore whether there are mitigations.
4. Introduce ethical frameworks: consequentialism (what outcomes does it produce?), deontology (what principles should guide us?), justice (who benefits, who is harmed?).
5. Guide them toward a nuanced position that acknowledges trade-offs.

Be balanced—neither utopian nor dystopian about AI. Push students to go beyond surface-level opinions. When they make a claim, ask "Why do you think that?" or "What evidence supports that?" Help them see multiple perspectives.

Key topics to explore: data privacy, algorithmic bias, equity of access, academic integrity, the role of human connection in learning, student autonomy, surveillance concerns.`,
      chatbotWelcome: "Let's have a thoughtful discussion about AI in education. To start: what do you see as the single most promising benefit of AI in education, and what concerns you most? Take a moment to think before responding.",
    },
  });

  // Assignment 2: Technology Integration Proposal
  await prisma.assignment.create({
    data: {
      courseId: course4.id,
      moduleId: c4m4.id,
      title: 'Technology Integration Proposal',
      description: 'Propose a plan for integrating a specific technology into an educational setting, using the SAMR and TPACK frameworks.',
      instructions: `<h3>Assignment Overview</h3>
<p>Propose a detailed plan for integrating a specific technology tool into an educational context you are familiar with (or aspire to work in).</p>

<h3>Requirements</h3>
<ol>
<li><strong>Context</strong> (100–150 words): Describe the educational setting (subject, level, student demographics, current challenges).</li>
<li><strong>Technology Selection</strong> (150–200 words): Identify the technology you want to integrate and explain why you chose it. This can be an AI tool, a collaborative platform, a simulation, or any educational technology.</li>
<li><strong>SAMR Analysis</strong> (200–300 words): Explain how your proposed integration fits the SAMR model. At which level does it operate? Could it be pushed to a higher level? How?</li>
<li><strong>TPACK Alignment</strong> (200–300 words): Analyze your proposal through the TPACK lens. How does the technology connect to your content knowledge and pedagogical knowledge?</li>
<li><strong>Implementation Plan</strong> (200–300 words): Timeline, resources needed, potential challenges, and mitigation strategies.</li>
<li><strong>Ethical Considerations</strong> (100–200 words): Address data privacy, equity, and any other ethical issues.</li>
</ol>

<h3>Submission</h3>
<p>Submit your proposal as a text entry (1000–1500 words total).</p>`,
      submissionType: 'text',
      dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      points: 100,
      isPublished: true,
    },
  });

  // Forum 2: AI in the Classroom
  await prisma.forum.create({
    data: {
      courseId: course4.id,
      moduleId: c4m4.id,
      title: 'Debate: AI in the Classroom - Help or Hindrance?',
      description: 'Take a position on whether AI tools should be widely adopted in K-12 and higher education classrooms. Support your argument with evidence from the course readings and your own research. Engage constructively with at least two classmates who hold different views.',
      isPublished: true,
      allowAnonymous: false,
      orderIndex: 0,
    },
  });

  // ---- Set up Course Tutors for Collaborative Module ----
  const socraticTutor = await prisma.chatbot.findUnique({ where: { name: 'socratic-tutor' } });
  const helperTutor = await prisma.chatbot.findUnique({ where: { name: 'helper-tutor' } });
  const carmenPeer = await prisma.chatbot.findUnique({ where: { name: 'carmen-peer' } });

  if (socraticTutor) {
    await prisma.courseTutor.upsert({
      where: { courseId_chatbotId: { courseId: course4.id, chatbotId: socraticTutor.id } },
      update: {},
      create: {
        courseId: course4.id,
        chatbotId: socraticTutor.id,
        isActive: true,
        displayOrder: 0,
      },
    });
    // Set as default tutor
    await prisma.course.update({
      where: { id: course4.id },
      data: { defaultTutorId: socraticTutor.id },
    });
  }

  if (helperTutor) {
    await prisma.courseTutor.upsert({
      where: { courseId_chatbotId: { courseId: course4.id, chatbotId: helperTutor.id } },
      update: {},
      create: {
        courseId: course4.id,
        chatbotId: helperTutor.id,
        isActive: true,
        displayOrder: 1,
      },
    });
  }

  if (carmenPeer) {
    await prisma.courseTutor.upsert({
      where: { courseId_chatbotId: { courseId: course4.id, chatbotId: carmenPeer.id } },
      update: {},
      create: {
        courseId: course4.id,
        chatbotId: carmenPeer.id,
        isActive: true,
        displayOrder: 2,
      },
    });
  }

  console.log('Set up collaborative module with tutors for Pedagogy course');

  console.log('Created all course content');

  // =========================================================================
  // CUSTOM LABS (TNA and Statistics)
  // =========================================================================

  const tnaLab = await prisma.customLab.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'TNA Lab',
      description: 'Transition Network Analysis - Explore group regulation patterns using the TNA R package',
      labType: 'tna',
      isPublic: true,
      createdBy: admin.id,
    },
  });

  // Add TNA templates
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

  const statsLab = await prisma.customLab.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Statistics Lab',
      description: 'Statistical Analysis - Perform common statistical tests and analyses using R',
      labType: 'statistics',
      isPublic: true,
      createdBy: admin.id,
    },
  });

  // Add Statistics templates
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

  // MSLQ Survey Lab (Pintrich et al., 1991)
  const mslqLab = await prisma.customLab.upsert({
    where: { id: 3 },
    update: {},
    create: {
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

  // COLLES Survey Lab (Taylor & Maor, 2000)
  const collesLab = await prisma.customLab.upsert({
    where: { id: 4 },
    update: {},
    create: {
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

  // SPQ Survey Lab (Biggs et al., 2001)
  const spqLab = await prisma.customLab.upsert({
    where: { id: 5 },
    update: {},
    create: {
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

  console.log('Created custom labs: TNA, Statistics, MSLQ, COLLES, R-SPQ-2F');

  // =========================================================================
  // SURVEYS (Pedagogical surveys for the Pedagogy course)
  // =========================================================================

  // Survey 1: Course Experience Questionnaire (based on Ramsden, 1991)
  const survey1 = await prisma.survey.create({
    data: {
      title: 'Course Experience Questionnaire',
      description: 'Based on the CEQ (Ramsden, 1991). This survey measures your experience across key dimensions of teaching quality. Your feedback helps improve the course.',
      courseId: course4.id,
      createdById: instructor.id,
      isPublished: true,
      isAnonymous: true,
    },
  });
  const ceqQuestions = [
    { questionText: 'The teaching staff normally gave me helpful feedback on how I was going.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 0 },
    { questionText: 'The staff made a real effort to understand difficulties I might be having with my work.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 1 },
    { questionText: 'The teaching staff motivated me to do my best work.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 2 },
    { questionText: 'It was always easy to know the standard of work expected.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 3 },
    { questionText: 'The course helped me develop my ability to work as a team member.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 4 },
    { questionText: 'The course developed my problem-solving skills.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 5 },
    { questionText: 'The workload was too heavy.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 6 },
    { questionText: 'What aspects of this course were most effective for your learning?', questionType: 'free_text', orderIndex: 7 },
    { questionText: 'What suggestions do you have for improving this course?', questionType: 'free_text', orderIndex: 8 },
  ];
  for (const q of ceqQuestions) {
    await prisma.surveyQuestion.create({ data: { surveyId: survey1.id, ...q, isRequired: true } });
  }

  // Survey 2: Self-Regulated Learning Strategies (based on Zimmerman & Pons, 1986)
  const survey2 = await prisma.survey.create({
    data: {
      title: 'Self-Regulated Learning Strategies',
      description: 'Based on Zimmerman & Pons (1986). This survey explores which self-regulated learning strategies you use during your studies. There are no right or wrong answers.',
      courseId: course4.id,
      createdById: instructor.id,
      isPublished: true,
      isAnonymous: false,
    },
  });
  const srlQuestions = [
    { questionText: 'I set specific goals for myself before I begin studying.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 0 },
    { questionText: 'I keep track of my progress toward my learning goals.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 1 },
    { questionText: 'I try to connect new material to what I already know.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 2 },
    { questionText: 'When I don\'t understand something, I seek help from classmates or the instructor.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 3 },
    { questionText: 'I review my notes regularly rather than only before exams.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 4 },
    { questionText: 'I organize my study environment to minimize distractions.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 5 },
    { questionText: 'After completing an assignment, I reflect on what I learned from the process.', questionType: 'single_choice', options: JSON.stringify(['Never', 'Rarely', 'Sometimes', 'Often', 'Always']), orderIndex: 6 },
    { questionText: 'Which learning strategies work best for you? Please describe.', questionType: 'free_text', orderIndex: 7 },
  ];
  for (const q of srlQuestions) {
    await prisma.surveyQuestion.create({ data: { surveyId: survey2.id, ...q, isRequired: true } });
  }

  // Survey 3: Technology Acceptance in Education (based on TAM - Davis, 1989)
  const survey3 = await prisma.survey.create({
    data: {
      title: 'Technology in Learning Survey',
      description: 'Based on the Technology Acceptance Model (Davis, 1989) adapted for education. This survey examines your perceptions of AI and technology tools used in this course.',
      courseId: course4.id,
      createdById: instructor.id,
      isPublished: true,
      isAnonymous: true,
    },
  });
  const tamQuestions = [
    { questionText: 'The AI tutoring tools in this course are easy to use.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 0 },
    { questionText: 'Using AI tools helps me understand course material better.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 1 },
    { questionText: 'I feel comfortable using technology for learning activities.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 2 },
    { questionText: 'The R coding labs enhance my data analysis skills.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 3 },
    { questionText: 'I intend to continue using AI-assisted learning tools in future courses.', questionType: 'single_choice', options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']), orderIndex: 4 },
    { questionText: 'Which technology tools used in this course did you find most valuable?', questionType: 'multiple_choice', options: JSON.stringify(['AI Chatbot Tutors', 'R Code Labs', 'Practice Quizzes', 'Discussion Forums', 'Lecture Chatbots']), orderIndex: 5 },
    { questionText: 'What concerns, if any, do you have about AI being used in education?', questionType: 'free_text', orderIndex: 6 },
  ];
  for (const q of tamQuestions) {
    await prisma.surveyQuestion.create({ data: { surveyId: survey3.id, ...q, isRequired: true } });
  }

  console.log('Created 3 pedagogical surveys for Pedagogy course');

  // Enroll student in all courses
  const allCourses = [course1, course2, course3, course4];
  for (const c of allCourses) {
    await prisma.enrollment.upsert({
      where: {
        userId_courseId: { userId: student.id, courseId: c.id },
      },
      update: {},
      create: {
        userId: student.id,
        courseId: c.id,
        status: 'active',
      },
    });
  }
  console.log('Enrolled student in all courses');

  // Create 30 fake students
  const fakeStudents = [
    { fullname: 'Emma Wilson', email: 'emma.wilson@laila.edu' },
    { fullname: 'Liam Anderson', email: 'liam.anderson@laila.edu' },
    { fullname: 'Olivia Martinez', email: 'olivia.martinez@laila.edu' },
    { fullname: 'Noah Thompson', email: 'noah.thompson@laila.edu' },
    { fullname: 'Ava Garcia', email: 'ava.garcia@laila.edu' },
    { fullname: 'Ethan Brown', email: 'ethan.brown@laila.edu' },
    { fullname: 'Sophia Davis', email: 'sophia.davis@laila.edu' },
    { fullname: 'Mason Rodriguez', email: 'mason.rodriguez@laila.edu' },
    { fullname: 'Isabella Lee', email: 'isabella.lee@laila.edu' },
    { fullname: 'Lucas White', email: 'lucas.white@laila.edu' },
    { fullname: 'Mia Harris', email: 'mia.harris@laila.edu' },
    { fullname: 'Alexander Clark', email: 'alexander.clark@laila.edu' },
    { fullname: 'Charlotte Lewis', email: 'charlotte.lewis@laila.edu' },
    { fullname: 'Benjamin Walker', email: 'benjamin.walker@laila.edu' },
    { fullname: 'Amelia Hall', email: 'amelia.hall@laila.edu' },
    { fullname: 'James Young', email: 'james.young@laila.edu' },
    { fullname: 'Harper Allen', email: 'harper.allen@laila.edu' },
    { fullname: 'William King', email: 'william.king@laila.edu' },
    { fullname: 'Evelyn Wright', email: 'evelyn.wright@laila.edu' },
    { fullname: 'Michael Scott', email: 'michael.scott@laila.edu' },
    { fullname: 'Abigail Adams', email: 'abigail.adams@laila.edu' },
    { fullname: 'Daniel Baker', email: 'daniel.baker@laila.edu' },
    { fullname: 'Emily Nelson', email: 'emily.nelson@laila.edu' },
    { fullname: 'Henry Carter', email: 'henry.carter@laila.edu' },
    { fullname: 'Elizabeth Mitchell', email: 'elizabeth.mitchell@laila.edu' },
    { fullname: 'Sebastian Perez', email: 'sebastian.perez@laila.edu' },
    { fullname: 'Sofia Roberts', email: 'sofia.roberts@laila.edu' },
    { fullname: 'Jack Turner', email: 'jack.turner@laila.edu' },
    { fullname: 'Aria Phillips', email: 'aria.phillips@laila.edu' },
    { fullname: 'Owen Campbell', email: 'owen.campbell@laila.edu' },
  ];

  const defaultStudentPassword = await bcrypt.hash(rawStudentPassword, 10);

  for (const studentData of fakeStudents) {
    const newStudent = await prisma.user.upsert({
      where: { email: studentData.email },
      update: {},
      create: {
        fullname: studentData.fullname,
        email: studentData.email,
        passwordHash: defaultStudentPassword,
        isAdmin: false,
        isInstructor: false,
        isConfirmed: true,
        isActive: true,
      },
    });

    // Enroll students in random courses
    for (const c of allCourses) {
      if (Math.random() > 0.4) {
        await prisma.enrollment.upsert({
          where: {
            userId_courseId: { userId: newStudent.id, courseId: c.id },
          },
          update: {},
          create: {
            userId: newStudent.id,
            courseId: c.id,
            status: Math.random() > 0.3 ? 'active' : 'completed',
            progress: Math.floor(Math.random() * 100),
          },
        });
      }
    }
  }
  console.log('Created 30 fake students with enrollments');

  // ═══════════════════════════════════════════════════════════
  //  Seed Learning Activity Logs (~3000 events)
  // ═══════════════════════════════════════════════════════════

  // Gather all enrolled students for activity generation
  const allEnrollments = await prisma.enrollment.findMany({
    include: { user: true, course: true },
  });

  // Course structure lookup: courseId → modules → lectures → sections
  const courseStructure: Record<number, {
    courseTitle: string;
    courseSlug: string;
    modules: { id: number; title: string; order: number; lectures: { id: number; title: string; order: number; sections: { id: number; title: string; order: number; subtype: string | null }[] }[] }[];
  }> = {};

  for (const c of allCourses) {
    const modules = await prisma.courseModule.findMany({
      where: { courseId: c.id },
      include: {
        lectures: {
          include: { sections: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    courseStructure[c.id] = {
      courseTitle: c.title,
      courseSlug: c.slug,
      modules: modules.map(m => ({
        id: m.id,
        title: m.title,
        order: m.orderIndex,
        lectures: m.lectures.map(l => ({
          id: l.id,
          title: l.title,
          order: l.orderIndex,
          sections: l.sections.map(s => ({
            id: s.id,
            title: s.title ?? '',
            order: s.order,
            subtype: s.type,
          })),
        })),
      })),
    };
  }

  // Verbs with realistic weights (some verbs are more common than others)
  const verbWeights: { verb: string; weight: number; objectTypes: string[] }[] = [
    { verb: 'viewed',      weight: 30, objectTypes: ['lecture', 'section', 'module', 'course'] },
    { verb: 'started',     weight: 12, objectTypes: ['lecture', 'section', 'video', 'assignment'] },
    { verb: 'completed',   weight: 10, objectTypes: ['lecture', 'section', 'module', 'quiz', 'assignment'] },
    { verb: 'progressed',  weight: 15, objectTypes: ['lecture', 'section', 'video'] },
    { verb: 'paused',      weight: 6,  objectTypes: ['video', 'lecture'] },
    { verb: 'resumed',     weight: 5,  objectTypes: ['video', 'lecture'] },
    { verb: 'submitted',   weight: 8,  objectTypes: ['assignment', 'quiz'] },
    { verb: 'messaged',    weight: 7,  objectTypes: ['chatbot'] },
    { verb: 'interacted',  weight: 4,  objectTypes: ['chatbot', 'section'] },
    { verb: 'downloaded',  weight: 3,  objectTypes: ['file', 'section'] },
    { verb: 'scrolled',    weight: 5,  objectTypes: ['lecture', 'section'] },
    { verb: 'seeked',      weight: 3,  objectTypes: ['video'] },
    { verb: 'graded',      weight: 2,  objectTypes: ['assignment', 'quiz'] },
  ];
  const totalVerbWeight = verbWeights.reduce((s, v) => s + v.weight, 0);

  // Weighted random verb picker
  function pickVerb() {
    let r = Math.random() * totalVerbWeight;
    for (const v of verbWeights) {
      r -= v.weight;
      if (r <= 0) return v;
    }
    return verbWeights[0];
  }

  // Random helpers
  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate timestamps spread across the last 90 days, with weekday bias
  function randomTimestamp(): Date {
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const base = new Date(now - Math.random() * ninetyDaysMs);
    // Add realistic hour-of-day distribution (more activity 8am-11pm)
    const hour = Math.random() < 0.85
      ? randomInt(8, 23)   // 85% during waking hours
      : randomInt(0, 7);   // 15% late night
    base.setHours(hour, randomInt(0, 59), randomInt(0, 59));
    return base;
  }

  // Learner profiles: each student gets a "style" that biases their verb distribution
  type LearnerProfile = 'diligent' | 'skimmer' | 'social' | 'balanced';
  const profiles: LearnerProfile[] = ['diligent', 'skimmer', 'social', 'balanced'];
  const profileVerbBoost: Record<LearnerProfile, Record<string, number>> = {
    diligent:  { completed: 3, submitted: 2, progressed: 2, viewed: 1.5 },
    skimmer:   { viewed: 3, scrolled: 3, paused: 0.3, completed: 0.5 },
    social:    { messaged: 4, interacted: 3, viewed: 1.2 },
    balanced:  {},  // no boost, use base weights
  };

  const devices = ['desktop', 'tablet', 'mobile'];
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  const deviceWeights = [0.6, 0.15, 0.25]; // desktop-heavy

  function pickDevice() {
    const r = Math.random();
    if (r < deviceWeights[0]) return devices[0];
    if (r < deviceWeights[0] + deviceWeights[1]) return devices[1];
    return devices[2];
  }

  console.log('Generating learning activity logs...');

  const activityBatch: Parameters<typeof prisma.learningActivityLog.createMany>[0]['data'] = [];

  // For each enrolled student, generate a variable number of events
  for (const enrollment of allEnrollments) {
    const profile = pickRandom(profiles);
    const boosts = profileVerbBoost[profile];
    const structure = courseStructure[enrollment.courseId];
    if (!structure || structure.modules.length === 0) continue;

    // Variable events per student: 20-120 depending on profile
    const baseEvents = profile === 'diligent' ? randomInt(60, 120)
      : profile === 'skimmer' ? randomInt(40, 90)
      : profile === 'social' ? randomInt(30, 70)
      : randomInt(25, 80);

    // Generate a session ID for bursts of activity
    let sessionId = crypto.randomUUID();
    let eventsInSession = 0;
    const maxEventsPerSession = randomInt(5, 25);

    for (let e = 0; e < baseEvents; e++) {
      // New session every N events
      eventsInSession++;
      if (eventsInSession > maxEventsPerSession) {
        sessionId = crypto.randomUUID();
        eventsInSession = 1;
      }

      // Pick verb with profile boost
      let chosen = pickVerb();
      const boost = boosts[chosen.verb] ?? 1;
      if (Math.random() > boost / (boost + 1)) {
        chosen = pickVerb(); // re-roll if boost is low
      }

      const objectType = pickRandom(chosen.objectTypes);

      // Build context from course structure
      let objectId: number | undefined;
      let objectTitle: string | undefined;
      let objectSubtype: string | null = null;
      let moduleId: number | undefined;
      let moduleTitle: string | undefined;
      let moduleOrder: number | undefined;
      let lectureId: number | undefined;
      let lectureTitle: string | undefined;
      let lectureOrder: number | undefined;
      let sectionId: number | undefined;
      let sectionTitle: string | undefined;
      let sectionOrder: number | undefined;

      const mod = pickRandom(structure.modules);
      moduleId = mod.id;
      moduleTitle = mod.title;
      moduleOrder = mod.order;

      if (['lecture', 'section', 'video', 'file'].includes(objectType) && mod.lectures.length > 0) {
        const lec = pickRandom(mod.lectures);
        lectureId = lec.id;
        lectureTitle = lec.title;
        lectureOrder = lec.order;

        if (['section', 'file'].includes(objectType) && lec.sections.length > 0) {
          const sec = pickRandom(lec.sections);
          sectionId = sec.id;
          sectionTitle = sec.title;
          sectionOrder = sec.order;
          objectSubtype = sec.subtype;
          objectId = sec.id;
          objectTitle = sec.title;
        } else {
          objectId = lec.id;
          objectTitle = lec.title;
        }
      } else if (objectType === 'module') {
        objectId = mod.id;
        objectTitle = mod.title;
      } else if (objectType === 'course') {
        objectId = enrollment.courseId;
        objectTitle = structure.courseTitle;
      } else if (objectType === 'assignment' || objectType === 'quiz') {
        // Use a section as proxy for assignment/quiz
        if (mod.lectures.length > 0) {
          const lec = pickRandom(mod.lectures);
          lectureId = lec.id;
          lectureTitle = lec.title;
          if (lec.sections.length > 0) {
            const sec = pickRandom(lec.sections);
            objectId = sec.id;
            objectTitle = sec.title || `${objectType} ${sec.id}`;
          }
        }
      } else if (objectType === 'chatbot') {
        objectTitle = pickRandom(['Research Methods Helper', 'Academic Writing Tutor', 'AI Tutor', 'Course Assistant']);
      }

      // Result fields
      let progress: number | undefined;
      let duration: number | undefined;
      let score: number | undefined;
      let maxScore: number | undefined;
      let success: boolean | undefined = true;

      if (['progressed', 'scrolled'].includes(chosen.verb)) {
        progress = Math.round(Math.random() * 100);
      }
      if (['viewed', 'started', 'progressed', 'paused', 'resumed', 'seeked'].includes(chosen.verb)) {
        duration = randomInt(5, 1800); // 5s to 30min
      }
      if (['submitted', 'graded'].includes(chosen.verb)) {
        maxScore = pickRandom([10, 20, 50, 100]);
        score = Math.round(Math.random() * maxScore * 10) / 10;
        success = score >= maxScore * 0.5;
        progress = 100;
      }
      if (chosen.verb === 'completed') {
        progress = 100;
        duration = randomInt(60, 3600);
      }

      activityBatch.push({
        userId: enrollment.userId,
        userEmail: enrollment.user.email,
        userFullname: enrollment.user.fullname,
        userRole: 'student',
        sessionId,
        verb: chosen.verb,
        objectType,
        objectId: objectId ?? null,
        objectTitle: objectTitle ?? null,
        objectSubtype: objectSubtype ?? null,
        courseId: enrollment.courseId,
        courseTitle: structure.courseTitle,
        courseSlug: structure.courseSlug,
        moduleId: moduleId ?? null,
        moduleTitle: moduleTitle ?? null,
        moduleOrder: moduleOrder ?? null,
        lectureId: lectureId ?? null,
        lectureTitle: lectureTitle ?? null,
        lectureOrder: lectureOrder ?? null,
        sectionId: sectionId ?? null,
        sectionTitle: sectionTitle ?? null,
        sectionOrder: sectionOrder ?? null,
        success: success ?? null,
        score: score ?? null,
        maxScore: maxScore ?? null,
        progress: progress ?? null,
        duration: duration ?? null,
        deviceType: pickDevice(),
        browserName: pickRandom(browsers),
        timestamp: randomTimestamp(),
      });
    }
  }

  // Batch insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < activityBatch.length; i += CHUNK_SIZE) {
    const chunk = activityBatch.slice(i, i + CHUNK_SIZE);
    await prisma.learningActivityLog.createMany({ data: chunk });
  }

  console.log(`Created ${activityBatch.length} learning activity log events`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
