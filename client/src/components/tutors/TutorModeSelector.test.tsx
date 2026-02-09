import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TutorModeSelector } from './TutorModeSelector';

describe('TutorModeSelector', () => {
  it('should render all three mode options', () => {
    render(
      <TutorModeSelector
        mode="manual"
        onModeChange={() => {}}
        disabled={false}
      />
    );

    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Auto-Route')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('should highlight the selected mode', () => {
    const { rerender } = render(
      <TutorModeSelector
        mode="manual"
        onModeChange={() => {}}
        disabled={false}
      />
    );

    // Manual should be selected
    const manualButton = screen.getByText('Manual').closest('button');
    expect(manualButton?.className).toContain('bg-primary');

    // Rerender with router mode
    rerender(
      <TutorModeSelector
        mode="router"
        onModeChange={() => {}}
        disabled={false}
      />
    );

    const routerButton = screen.getByText('Auto-Route').closest('button');
    expect(routerButton?.className).toContain('bg-primary');
  });

  it('should call onModeChange when a mode is clicked', () => {
    const handleModeChange = vi.fn();
    render(
      <TutorModeSelector
        mode="manual"
        onModeChange={handleModeChange}
        disabled={false}
      />
    );

    fireEvent.click(screen.getByText('Auto-Route'));
    expect(handleModeChange).toHaveBeenCalledWith('router');

    fireEvent.click(screen.getByText('Team'));
    expect(handleModeChange).toHaveBeenCalledWith('collaborative');
  });

  it('should not call onModeChange when disabled', () => {
    const handleModeChange = vi.fn();
    render(
      <TutorModeSelector
        mode="manual"
        onModeChange={handleModeChange}
        disabled={true}
      />
    );

    fireEvent.click(screen.getByText('Auto-Route'));
    expect(handleModeChange).not.toHaveBeenCalled();
  });

  it('should show disabled styling when disabled', () => {
    const { container } = render(
      <TutorModeSelector
        mode="manual"
        onModeChange={() => {}}
        disabled={true}
      />
    );

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('should display mode descriptions', () => {
    render(
      <TutorModeSelector
        mode="manual"
        onModeChange={() => {}}
        disabled={false}
      />
    );

    // Check for actual descriptions from the component
    expect(screen.getByText('Choose which tutor responds')).toBeInTheDocument();
    expect(screen.getByText('AI picks the best tutor')).toBeInTheDocument();
    expect(screen.getByText('All tutors contribute')).toBeInTheDocument();
  });

  it('should call onModeChange even when clicking already selected mode', () => {
    const handleModeChange = vi.fn();
    render(
      <TutorModeSelector
        mode="manual"
        onModeChange={handleModeChange}
        disabled={false}
      />
    );

    fireEvent.click(screen.getByText('Manual'));
    // Component still calls onModeChange
    expect(handleModeChange).toHaveBeenCalledWith('manual');
  });
});
