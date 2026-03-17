import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Projects } from '../Projects';
import * as api from '../../services/api';
import { mockProjects } from '../../test/mocks/api';

vi.mock('../../services/api', () => ({
  projectsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders projects page', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: mockProjects } as any);

    renderWithRouter(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });
  });

  it('displays list of projects', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: mockProjects } as any);

    renderWithRouter(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Another Project')).toBeInTheDocument();
    });
  });

  it('shows project statistics', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: mockProjects } as any);

    renderWithRouter(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('2 sources')).toBeInTheDocument();
      expect(screen.getByText('5 mentions')).toBeInTheDocument();
    });
  });

  it('opens create project modal when clicking new project button', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: [] } as any);

    renderWithRouter(<Projects />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    const newProjectButton = screen.getByText('New Project');
    fireEvent.click(newProjectButton);

    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });
  });

  it('creates new project successfully', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: [] } as any);
    vi.mocked(api.projectsApi.create).mockResolvedValue({
      data: { id: '3', name: 'New Project' },
    } as any);

    renderWithRouter(<Projects />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('New Project'));

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText('Name');
    await userEvent.type(nameInput, 'New Project');

    const descriptionInput = screen.getByLabelText('Description');
    await userEvent.type(descriptionInput, 'Project description');

    // Submit
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(api.projectsApi.create).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'Project description',
        website: '',
        userId: 'temp-user-id',
      });
    });
  });

  it('displays empty state when no projects', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: [] } as any);

    renderWithRouter(<Projects />);

    await waitFor(() => {
      expect(screen.getByText(/No projects yet/i)).toBeInTheDocument();
    });
  });

  it('shows project website link when available', async () => {
    vi.mocked(api.projectsApi.getAll).mockResolvedValue({ data: mockProjects } as any);

    renderWithRouter(<Projects />);

    await waitFor(() => {
      expect(screen.getByText('Website')).toBeInTheDocument();
    });
  });
});
