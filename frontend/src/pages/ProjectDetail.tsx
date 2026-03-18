import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Code } from 'lucide-react';
import { projectsApi, sourcesApi, widgetApi } from '../services/api';
import type { Project, Source } from '../types';
import { Modal } from '../components/Modal';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [embedCode, setEmbedCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [newSource, setNewSource] = useState<{
    platform: Source['platform'];
    name: string;
    config: Record<string, any>;
  }>({
    platform: 'github',
    name: '',
    config: {
      owner: '',
      repo: '',
      includeIssues: true,
      includeComments: true,
    },
  });

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, sourcesRes] = await Promise.all([
        projectsApi.getById(id!),
        sourcesApi.getAll(id),
      ]);
      setProject(projectRes.data);
      setSources(sourcesRes.data);
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sourcesApi.create({
        ...newSource,
        projectId: id,
        isActive: true,
      });
      setIsSourceModalOpen(false);
      setNewSource({
        platform: 'github',
        name: '',
        config: { owner: '', repo: '', includeIssues: true, includeComments: true },
      });
      fetchProjectData();
    } catch (error) {
      console.error('Failed to add source:', error);
    }
  };

  const handleShowEmbedCode = async () => {
    try {
      const res = await widgetApi.getEmbedCode(id!);
      setEmbedCode(res.data.code);
      setIsWidgetModalOpen(true);
    } catch (error) {
      console.error('Failed to get embed code:', error);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      github: '🔧',
      producthunt: '🚀',
      twitter: '🐦',
      zhihu: '📚',
      xiaohongshu: '📝',
      chromewebstore: '🌐',
    };
    return icons[platform] || '📎';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/projects" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sources */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Sources</h2>
            <button
              onClick={() => setIsSourceModalOpen(true)}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Source
            </button>
          </div>

          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="p-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getPlatformIcon(source.platform)}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">{source.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{source.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        source.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {source.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {source.lastFetchedAt && (
                      <span className="text-xs text-gray-500">
                        Last fetched: {new Date(source.lastFetchedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {sources.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg">
              No sources yet. Add a source to start collecting mentions.
            </div>
          )}
        </div>

        {/* Widget Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Widget</h2>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Layout</label>
                <select
                  value={project.widgetConfig?.layout || 'carousel'}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  disabled
                >
                  <option value="carousel">Carousel</option>
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Theme</label>
                <select
                  value={project.widgetConfig?.theme || 'light'}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  disabled
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <button
                onClick={handleShowEmbedCode}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
              >
                <Code className="w-4 h-4 mr-2" />
                Get Embed Code
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      <Modal isOpen={isSourceModalOpen} onClose={() => setIsSourceModalOpen(false)} title="Add Source">
        <form onSubmit={handleAddSource} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Platform</label>
            <select
              value={newSource.platform}
              onChange={(e) =>
                setNewSource({ ...newSource, platform: e.target.value as Source['platform'] })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="github">GitHub</option>
              <option value="producthunt">Product Hunt</option>
              <option value="chromewebstore">Chrome Web Store</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={newSource.name}
              onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="e.g., My GitHub Repo"
              required
            />
          </div>
          {newSource.platform === 'github' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Owner</label>
                <input
                  type="text"
                  value={newSource.config.owner || ''}
                  onChange={(e) =>
                    setNewSource({
                      ...newSource,
                      config: { ...newSource.config, owner: e.target.value },
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., facebook"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Repository</label>
                <input
                  type="text"
                  value={newSource.config.repo || ''}
                  onChange={(e) =>
                    setNewSource({
                      ...newSource,
                      config: { ...newSource.config, repo: e.target.value },
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., react"
                  required
                />
              </div>
            </>
          )}
          {newSource.platform === 'chromewebstore' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Extension ID</label>
                <input
                  type="text"
                  value={newSource.config.extensionId || ''}
                  onChange={(e) =>
                    setNewSource({
                      ...newSource,
                      config: { ...newSource.config, extensionId: e.target.value },
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., chphlpgkkbolifaimnlloiipkdnihall"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Found in the Chrome Web Store URL: /detail/[name]/<strong>extension-id</strong>
                </p>
              </div>
            </>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setIsSourceModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              Add Source
            </button>
          </div>
        </form>
      </Modal>

      {/* Widget Embed Modal */}
      <Modal isOpen={isWidgetModalOpen} onClose={() => setIsWidgetModalOpen(false)} title="Embed Code">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Copy and paste this code into your website where you want the widget to appear:
          </p>
          <pre className="p-4 bg-gray-100 rounded-lg overflow-x-auto text-sm">{embedCode}</pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(embedCode);
              alert('Copied to clipboard!');
            }}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            Copy Code
          </button>
        </div>
      </Modal>
    </div>
  );
}
