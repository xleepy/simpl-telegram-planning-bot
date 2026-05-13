import { useState } from 'react';

interface AddItemFormProps {
  onAdd: (text: string, category: string) => void;
}

const CATEGORIES = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'gear', label: 'Gear' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'other', label: 'Other' },
];

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('other');
  const [showPicker, setShowPicker] = useState(false);

  const handleSubmit = () => {
    if (text.trim()) {
      onAdd(text.trim(), category);
      setText('');
    }
  };

  return (
    <div className="add-item-form">
      <div className="add-item-row">
        <input
          type="text"
          className="add-item-input"
          placeholder="Add item..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          className="category-btn"
          onClick={() => setShowPicker(!showPicker)}
        >
          {CATEGORIES.find((c) => c.value === category)?.label || 'Other'}
        </button>
        <button className="add-btn" onClick={handleSubmit}>
          Add
        </button>
      </div>
      {showPicker && (
        <div className="category-picker">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              className={`picker-option ${category === c.value ? 'picker-active' : ''}`}
              onClick={() => {
                setCategory(c.value);
                setShowPicker(false);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
