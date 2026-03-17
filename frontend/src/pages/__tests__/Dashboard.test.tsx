import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../Dashboard';
import * as api from '../../services/api';
import { mockProjects, mockMentions } from '../../test/mocks/api';

// Mock the API module
vi.mock('../../services/api', () => ({
  projectsApi: {
    getAll: vi.fn(),
  },
  mentionsApi: {
    getAll: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: [] } as any);
    vi.mocked(api.mentionsApi.getAll).mockResolvedValue({ data: [] } as any);

    renderWithRouter(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    vi.mocked(api.projectsApi.getAll).mockImplementation(() => new Promise(() => {}));
    vi.mocked(api.mentionsApi.getAll).mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<Dashboard />);
    
    // Loading spinner should be visible (check for the spinning element)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays stats correctly', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: mockProjects } as any);
    vi.mocked(api.mentionsApi.getAll).mockResolvedValue({
      data: [
        ...mockMentions,
        { ...mockMentions[0], id: '3', status: 'approved' },
        { ...mockMentions[0], id: '4', status: 'pending' },
      ],
    } as any);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      // Use getAllByText for multiple elements with same text
      const statValues = screen.getAllByText('2');
      expect(statValues.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays recent mentions', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: mockProjects } as any);
    vi.mocked(api.mentionsApi.getAll).mockResolvedValue({ data: mockMentions } as any);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('This is a great project!')).toBeInTheDocument();
      expect(screen.getByText('Love this tool!')).toBeInTheDocument();
    });
  });

  it('displays empty state when no mentions', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: [] } as any);
    vi.mocked(api.mentionsApi.getAll).mockResolvedValue({ data: [] } as any);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No mentions yet/i)).toBeInTheDocument();
    });
  });

  it('displays status badges correctly', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: [] } as any);
    vi.mocked(api.mentionsApi.getAll).mockResolvedValue({ data: mockMentions } as any);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('approved')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });
});
