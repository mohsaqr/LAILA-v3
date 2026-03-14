import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a secure random password.
 * Set SEED_ADMIN_PASSWORD environment variable to use a consistent password.
 */
function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64url');
}

async function main() {
  console.log('Seeding database...');

  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD || generateSecurePassword();

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('Generated admin password:', rawAdminPassword);
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

  // Seed default categories
  const categoryTitles = [
    // Technology
    'Programming', 'Web Development', 'Mobile Development', 'Data Science',
    'Machine Learning', 'Artificial Intelligence', 'Cybersecurity', 'Cloud Computing',
    'DevOps', 'Databases', 'Networking', 'Blockchain',
    // Creative & Design
    'Design', 'UI/UX Design', 'Graphic Design', '3D Modeling',
    'Video Production', 'Photography', 'Animation', 'Game Development',
    // Business & Finance
    'Business', 'Entrepreneurship', 'Finance', 'Accounting',
    'Project Management', 'Leadership', 'Marketing', 'Sales',
    'Human Resources', 'Operations', 'Supply Chain', 'Real Estate',
    // Science & Academia
    'Mathematics', 'Statistics', 'Physics', 'Biology',
    'Chemistry', 'Environmental Science', 'Research Methods', 'Academic Writing',
    // Humanities & Social
    'History', 'Philosophy', 'Psychology', 'Sociology',
    'Political Science', 'Economics', 'Law',
    // Language & Education
    'Language', 'Education', 'Teaching', 'Linguistics',
    // Health & Lifestyle
    'Health & Wellness', 'Nutrition', 'Other',
  ];
  for (const title of categoryTitles) {
    await prisma.category.upsert({
      where: { title },
      update: {},
      create: { title },
    });
  }
  console.log('Created default categories');

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
