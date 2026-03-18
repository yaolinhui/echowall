import { useEffect, useState } from 'react';
import { Plus, ExternalLink, Settings, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../services/api';
import type { Project } from '../types';
import { Modal } from '../components/Modal';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    website: '',
    userId: 'temp-user-id', // TODO: 从 auth context 获取
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await projectsApi.getAll();
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectsApi.create(newProject);
      setIsModalOpen(false);
      setNewProject({ name: '', description: '', website: '', userId: 'temp-user-id' });
      fetchProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectsApi.delete(id);
      fetchProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-lg shadow-sm">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                <div className="flex space-x-2">
                  <Link
                    to={`/projects/${project.id}`}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>
              {project.website && (
                <a
                  href={project.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center mt-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Website
                </a>
              )}
            </div>
            <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{project.sourcesCount || 0} sources</span>
                <span>{project.mentionsCount || 0} mentions</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="p-12 text-center bg-white rounded-lg">
          <p className="text-gray-500">No projects yet. Create your first project to get started.</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Project">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="project-name"
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label htmlFor="project-description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="project-description"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Website</label>
            <input
              type="url"
              value={newProject.website}
              onChange={(e) => setNewProject({ ...newProject, website: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              placeholder="https://example.com"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
