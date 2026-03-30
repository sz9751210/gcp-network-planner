import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FirewallInspector } from '../components/FirewallInspector';
import { buildTestProject } from './fixtures';

describe('FirewallInspector', () => {
	it('expands grouped network rules', () => {
		render(<FirewallInspector projects={[buildTestProject()]} selectedProjectId="all" />);

		const networkEntries = screen.getAllByText('test-vpc');
		fireEvent.click(networkEntries[networkEntries.length - 1]);
		expect(screen.getByText('allow-ssh')).toBeInTheDocument();
	});
});
