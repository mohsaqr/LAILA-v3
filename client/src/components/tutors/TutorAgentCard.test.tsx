import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TutorAgentCard } from './TutorAgentCard';
import type { TutorAgent, TutorConversation } from '../../types/tutor';

describe('TutorAgentCard', () => {
  const mockAgent: TutorAgent = {
    id: 1,
    name: 'socratic-tutor',
    displayName: 'Socratic Guide',
    description: 'Guides learning through thoughtful questions',
    avatarUrl: '/avatars/socratic.svg',
    welcomeMessage: 'Hello! What would you like to explore?',
    personality: 'socratic',
    temperature: 0.7,
    systemPrompt: 'You are a Socratic tutor.',
    isActive: true,
  };

  const mockConversation: TutorConversation = {
    id: 1,
    sessionId: 1,
    chatbotId: 1,
    lastMessageAt: new Date().toISOString(),
    messageCount: 5,
    createdAt: new Date().toISOString(),
    chatbot: {
      id: 1,
      name: 'socratic-tutor',
      displayName: 'Socratic Guide',
      description: 'Guides learning through thoughtful questions',
      avatarUrl: '/avatars/socratic.svg',
      welcomeMessage: 'Hello! What would you like to explore?',
      personality: 'socratic',
    },
    lastMessage: {
      role: 'assistant',
      content: 'That is a great question! What do you think?',
      createdAt: new Date().toISOString(),
    },
  };

  it('should render agent display name', () => {
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={null}
        isSelected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('Socratic Guide')).toBeInTheDocument();
  });

  it('should render agent description when no conversation', () => {
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={null}
        isSelected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('Guides learning through thoughtful questions')).toBeInTheDocument();
  });

  it('should render last message preview when conversation exists', () => {
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={mockConversation}
        isSelected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText(/That is a great question/)).toBeInTheDocument();
  });

  it('should show message count when conversation has messages', () => {
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={mockConversation}
        isSelected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should not show message count when no messages', () => {
    const emptyConversation = { ...mockConversation, messageCount: 0 };
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={emptyConversation}
        isSelected={false}
        onClick={() => {}}
      />
    );

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should apply selected styles when isSelected is true', () => {
    const { container } = render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={null}
        isSelected={true}
        onClick={() => {}}
      />
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-primary-50');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={null}
        isSelected={false}
        onClick={handleClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render avatar image when avatarUrl exists', () => {
    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={null}
        isSelected={false}
        onClick={() => {}}
      />
    );

    const avatar = screen.getByAltText('Socratic Guide');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', '/avatars/socratic.svg');
  });

  it('should render online indicator', () => {
    const { container } = render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={null}
        isSelected={false}
        onClick={() => {}}
      />
    );

    // Online indicator is a small green circle
    const onlineIndicator = container.querySelector('.bg-green-500');
    expect(onlineIndicator).toBeInTheDocument();
  });

  it('should truncate long last messages', () => {
    const longMessageConversation = {
      ...mockConversation,
      lastMessage: {
        role: 'assistant' as const,
        content: 'This is a very long message that should be truncated because it exceeds the maximum length',
        createdAt: new Date().toISOString(),
      },
    };

    render(
      <TutorAgentCard
        agent={mockAgent}
        conversation={longMessageConversation}
        isSelected={false}
        onClick={() => {}}
      />
    );

    // Component truncates at 30 chars: "This is a very long message th..."
    expect(screen.getByText(/This is a very long message th\.\.\./)).toBeInTheDocument();
  });
});
