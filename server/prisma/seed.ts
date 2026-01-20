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

  // Create a sample course
  const course = await prisma.course.upsert({
    where: { slug: 'intro-to-ai-research' },
    update: {},
    create: {
      title: 'Introduction to AI-Powered Research',
      slug: 'intro-to-ai-research',
      description: 'Learn how to leverage AI tools for academic research, including bias detection, prompt engineering, and data analysis.',
      instructorId: instructor.id,
      category: 'Research Methods',
      difficulty: 'beginner',
      status: 'published',
      isPublic: true,
      publishedAt: new Date(),
    },
  });
  console.log('Created sample course:', course.title);

  // Create course modules
  const modules = [
    {
      title: 'Getting Started with AI Research Tools',
      description: 'An introduction to the AI-powered research tools available in LAILA.',
      orderIndex: 0,
      isPublished: true,
    },
    {
      title: 'Understanding Bias in AI',
      description: 'Learn to identify and address bias in AI-generated content and research.',
      orderIndex: 1,
      isPublished: true,
    },
    {
      title: 'Prompt Engineering Fundamentals',
      description: 'Master the art of crafting effective prompts for AI tools.',
      orderIndex: 2,
      isPublished: true,
    },
  ];

  for (const moduleData of modules) {
    const module = await prisma.courseModule.upsert({
      where: {
        id: -1, // Force create
      },
      update: {},
      create: {
        ...moduleData,
        courseId: course.id,
      },
    });

    // Create lectures for each module
    const lectures = [
      {
        title: `${moduleData.title} - Overview`,
        content: `<h2>Welcome to ${moduleData.title}</h2><p>This lecture introduces the key concepts of this module.</p>`,
        contentType: 'text',
        orderIndex: 0,
        isPublished: true,
        isFree: moduleData.orderIndex === 0,
        duration: 15,
      },
      {
        title: `${moduleData.title} - Practical Application`,
        content: `<h2>Practical Application</h2><p>Let's apply what we've learned in hands-on exercises.</p>`,
        contentType: 'text',
        orderIndex: 1,
        isPublished: true,
        duration: 30,
      },
    ];

    for (const lectureData of lectures) {
      await prisma.lecture.create({
        data: {
          ...lectureData,
          moduleId: module.id,
        },
      });
    }
  }
  console.log('Created course modules and lectures');

  // Create a sample assignment
  await prisma.assignment.create({
    data: {
      courseId: course.id,
      title: 'Bias Detection Exercise',
      description: 'Identify and analyze potential biases in a given AI-generated text.',
      instructions: 'Read the provided AI-generated vignette and write a 500-word analysis identifying potential biases.',
      submissionType: 'text',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
      points: 100,
      isPublished: true,
    },
  });
  console.log('Created sample assignment');

  // Enroll student in course
  await prisma.enrollment.upsert({
    where: {
      userId_courseId: { userId: student.id, courseId: course.id },
    },
    update: {},
    create: {
      userId: student.id,
      courseId: course.id,
      status: 'active',
    },
  });
  console.log('Enrolled student in course');

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

    // Enroll some students in the course (randomly ~60%)
    if (Math.random() > 0.4) {
      await prisma.enrollment.upsert({
        where: {
          userId_courseId: { userId: newStudent.id, courseId: course.id },
        },
        update: {},
        create: {
          userId: newStudent.id,
          courseId: course.id,
          status: Math.random() > 0.3 ? 'active' : 'completed',
          progress: Math.floor(Math.random() * 100),
        },
      });
    }
  }
  console.log('Created 30 fake students');

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
