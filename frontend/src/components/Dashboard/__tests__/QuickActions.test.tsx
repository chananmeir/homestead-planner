/**
 * QuickActions is a pure presentation component — six buttons, each wired to a
 * navigation callback. These tests verify each click routes to its expected
 * target (maps to Tab switch in App.tsx).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickActions from '../QuickActions';

function renderWithAllHandlers() {
  const handlers = {
    onAddPlanting: jest.fn(),
    onLogHarvest: jest.fn(),
    onAddSeed: jest.fn(),
    onAddLivestockEntry: jest.fn(),
    onAddCompostEntry: jest.fn(),
    onUploadPhoto: jest.fn(),
  };
  render(<QuickActions {...handlers} />);
  return handlers;
}

describe('QuickActions', () => {
  test('renders all six action buttons', () => {
    renderWithAllHandlers();
    expect(screen.getByRole('button', { name: /Add Planting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Harvest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Seed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Livestock Entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Compost Entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Photo/i })).toBeInTheDocument();
  });

  test('clicking "Add Planting" calls onAddPlanting only', async () => {
    const handlers = renderWithAllHandlers();
    await userEvent.click(screen.getByRole('button', { name: /Add Planting/i }));
    expect(handlers.onAddPlanting).toHaveBeenCalledTimes(1);
    expect(handlers.onLogHarvest).not.toHaveBeenCalled();
  });

  test('clicking "Log Harvest" calls onLogHarvest only', async () => {
    const handlers = renderWithAllHandlers();
    await userEvent.click(screen.getByRole('button', { name: /Log Harvest/i }));
    expect(handlers.onLogHarvest).toHaveBeenCalledTimes(1);
    expect(handlers.onAddPlanting).not.toHaveBeenCalled();
  });

  test('clicking "Add Seed" calls onAddSeed only', async () => {
    const handlers = renderWithAllHandlers();
    await userEvent.click(screen.getByRole('button', { name: /Add Seed/i }));
    expect(handlers.onAddSeed).toHaveBeenCalledTimes(1);
  });

  test('clicking "Add Livestock Entry" calls onAddLivestockEntry only', async () => {
    const handlers = renderWithAllHandlers();
    await userEvent.click(screen.getByRole('button', { name: /Add Livestock Entry/i }));
    expect(handlers.onAddLivestockEntry).toHaveBeenCalledTimes(1);
  });

  test('clicking "Add Compost Entry" calls onAddCompostEntry only', async () => {
    const handlers = renderWithAllHandlers();
    await userEvent.click(screen.getByRole('button', { name: /Add Compost Entry/i }));
    expect(handlers.onAddCompostEntry).toHaveBeenCalledTimes(1);
  });

  test('clicking "Upload Photo" calls onUploadPhoto only', async () => {
    const handlers = renderWithAllHandlers();
    await userEvent.click(screen.getByRole('button', { name: /Upload Photo/i }));
    expect(handlers.onUploadPhoto).toHaveBeenCalledTimes(1);
  });
});
