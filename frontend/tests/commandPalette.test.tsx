import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommandPalette } from '../components/CommandPalette';
import { buildTestProject } from './fixtures';

describe('CommandPalette', () => {
	it('searches resources and navigates without crashing', () => {
		const onNavigate = vi.fn();
		render(<CommandPalette projects={[buildTestProject()]} onNavigate={onNavigate} />);

		fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
		const input = screen.getByPlaceholderText(
			'Search projects, VPCs, IPs, Workloads, PVCs...'
		);

		fireEvent.change(input, { target: { value: 'test-instance' } });
		const result = screen.getByText('test-instance');
		fireEvent.click(result);

		expect(onNavigate).toHaveBeenCalledTimes(1);
		expect(onNavigate).toHaveBeenCalledWith('gce', 'test-project');
	});
});
