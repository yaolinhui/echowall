import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const mockProjects = [
  {
    id: '1',
    name: 'Test Project',
    description: 'A test project',
    website: 'https://example.com',
    isActive: true,
    sourcesCount: 2,
    mentionsCount: 5,
    createdAt: '2026-03-15T10:00:00Z',
    widgetConfig: {
      theme: 'light',
      layout: 'carousel',
      maxItems: 10,
      autoPlay: true,
    },
  },
  {
    id: '2',
    name: 'Another Project',
    description: 'Another test project',
    isActive: true,
    sourcesCount: 1,
    mentionsCount: 3,
    createdAt: '2026-03-14T10:00:00Z',
    widgetConfig: {
      theme: 'dark',
      layout: 'grid',
      maxItems: 20,
      autoPlay: false,
    },
  },
];

export const mockMentions = [
  {
    id: '1',
    platform: 'github',
    content: 'This is a great project!',
    authorName: 'John Doe',
    authorAvatar: 'https://example.com/avatar.jpg',
    sourceUrl: 'https://github.com/user/repo/issues/1',
    postedAt: '2026-03-15T10:00:00Z',
    sentiment: 'positive',
    sentimentScore: 0.9,
    status: 'approved',
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    id: '2',
    platform: 'producthunt',
    content: 'Love this tool!',
    authorName: 'Jane Smith',
    authorAvatar: null,
    sourceUrl: 'https://producthunt.com/posts/test',
    postedAt: '2026-03-14T10:00:00Z',
    sentiment: 'positive',
    sentimentScore: 0.85,
    status: 'pending',
    createdAt: '2026-03-14T10:00:00Z',
  },
];

const handlers = [
  // Projects
  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),
  
  http.get('*/api/projects/:id', ({ params }) => {
    const project = mockProjects.find(p => p.id === params.id);
    if (!project) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(project);
  }),
  
  http.post('*/api/projects', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: '3',
      ...body,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),
  
  http.patch('*/api/projects/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ...mockProjects[0],
      ...body,
    });
  }),
  
  http.delete('*/api/projects/:id', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Mentions
  http.get('*/api/mentions', () => {
    return HttpResponse.json(mockMentions);
  }),
  
  http.patch('*/api/mentions/:id', async ({ request, params }) => {
    const body = await request.json();
    const mention = mockMentions.find(m => m.id === params.id);
    return HttpResponse.json({ ...mention, ...body });
  }),

  // Widget
  http.get('*/api/widget/:id/data', () => {
    return HttpResponse.json({
      project: mockProjects[0],
      mentions: mockMentions.filter(m => m.status === 'approved'),
      config: mockProjects[0].widgetConfig,
    });
  }),
  
  http.get('*/api/widget/:id/embed', () => {
    return HttpResponse.json({
      code: '<script src="widget.js"></script>',
    });
  }),
];

export const server = setupServer(...handlers);
