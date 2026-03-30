import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CloudArmorInventory } from '../components/CloudArmorInventory';
import { buildTestProject } from './fixtures';

describe('CloudArmorInventory', () => {
	it('expands policy rules', () => {
		render(<CloudArmorInventory projects={[buildTestProject()]} selectedProjectId="all" />);

		fireEvent.click(screen.getByText('armor-policy'));
		expect(screen.getByText('Security Rules')).toBeInTheDocument();
		expect(screen.getByText('ALLOW')).toBeInTheDocument();
	});
});
