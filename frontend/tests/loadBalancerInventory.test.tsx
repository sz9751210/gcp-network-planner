import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoadBalancerInventory } from '../components/LoadBalancerInventory';
import { buildTestProject } from './fixtures';

describe('LoadBalancerInventory', () => {
	it('expands load balancer topology', () => {
		render(<LoadBalancerInventory projects={[buildTestProject()]} selectedProjectId="all" />);

		fireEvent.click(screen.getByText('test-lb'));
		expect(screen.getByText('Target Proxy / Map')).toBeInTheDocument();
	});
});
