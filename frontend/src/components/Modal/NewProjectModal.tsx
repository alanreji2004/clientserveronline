import React, { useState } from 'react';
import { X, Layers } from 'lucide-react';
import type { ProjectTemplateInfo } from '../../types';

interface NewProjectModalProps {
  isOpen: boolean;
  templates: ProjectTemplateInfo[];
  onClose: () => void;
  onCreate: (name: string, description: string, template: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  templates,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('python-sockets');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim(), selectedTemplate);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        width: 'min(460px, calc(100vw - 24px))',
        maxHeight: 'calc(100vh - 24px)',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--border-color)',
        overflowY: 'auto'
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="var(--accent-color)" /> Create New Project
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
              Project Name
            </label>
            <input
              autoFocus
              type="text"
              required
              placeholder="e.g. My Socket Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Brief description of your project"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
              Starter Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.language})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                padding: '7px 16px',
                borderRadius: '5px',
                backgroundColor: 'var(--accent-color)',
                color: '#fff',
                fontWeight: 500,
                opacity: name.trim() ? 1 : 0.5
              }}
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
