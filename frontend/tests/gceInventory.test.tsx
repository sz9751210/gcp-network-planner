import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GceInventory } from '../components/GceInventory';
import { buildTestProject } from './fixtures';

describe('GceInventory', () => {
	it('opens instance detail modal', () => {
		render(<GceInventory projects={[buildTestProject()]} selectedProjectId="all" />);

		const buttons = screen.getAllByRole('button');
		fireEvent.click(buttons[buttons.length - 1]);

		expect(screen.getByText('Network Configuration')).toBeInTheDocument();
		expect(screen.getByText('ID: inst-1')).toBeInTheDocument();
	});
});
