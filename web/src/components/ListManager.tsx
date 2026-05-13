import { useState } from 'react';

interface ListData {
  id: string;
  name: string;
}

interface ListManagerProps {
  lists: ListData[];
  activeListId: string | null;
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function ListManager({
  lists,
  activeListId,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: ListManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
      setEditingId(null);
      setEditName('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Manage Lists</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="create-list-row">
            <input
              type="text"
              className="create-list-input"
              placeholder="New list name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button className="create-list-btn" onClick={handleCreate}>
              Create
            </button>
          </div>

          <div className="existing-lists">
            {lists.map((list) => (
              <div
                key={list.id}
                className={`existing-list-row ${list.id === activeListId ? 'active-list' : ''}`}
              >
                {editingId === list.id ? (
                  <>
                    <input
                      type="text"
                      className="edit-list-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(list.id)}
                      autoFocus
                    />
                    <button
                      className="save-btn"
                      onClick={() => handleRename(list.id)}
                    >
                      Save
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="list-name">{list.name}</span>
                    <div className="list-actions">
                      <button
                        className="rename-btn"
                        onClick={() => {
                          setEditingId(list.id);
                          setEditName(list.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => {
                          if (window.confirm(`Delete list "${list.name}" and all its items?`)) {
                            onDelete(list.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {lists.length === 0 && (
              <p className="no-lists">No lists yet. Create one above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
