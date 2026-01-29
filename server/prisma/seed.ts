import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@laila.edu' },
    update: {},
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
  const instructorPassword = await bcrypt.hash('instructor123', 10);
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@laila.edu' },
    update: {},
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
    update: {},
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
  const studentPassword = await bcrypt.hash('student123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@laila.edu' },
    update: {},
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
      avatarUrl: '/avatars/socratic.png',
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
      avatarUrl: '/avatars/helper.png',
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
      avatarUrl: '/avatars/peer.png',
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
      avatarUrl: '/avatars/project.png',
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
      avatarUrl: '/avatars/carmen.png',
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
      avatarUrl: '/avatars/laila.png',
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
      avatarUrl: '/avatars/beatrice.png',
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

  console.log('Created all course content');

  // Enroll student in all courses
  const allCourses = [course1, course2, course3];
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

  const defaultStudentPassword = await bcrypt.hash('student123', 10);

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
