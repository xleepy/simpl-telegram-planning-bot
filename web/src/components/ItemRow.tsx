import { CategoryDot } from './CategoryDot';

interface ItemData {
  id: string;
  text: string;
  completed: boolean;
  completedBy: string | null;
  category: string;
}

interface ItemRowProps {
  item: ItemData;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  return (
    <div className={`item-row ${item.completed ? 'item-done' : ''}`}>
      <button
        className={`checkbox ${item.completed ? 'checkbox-checked' : ''}`}
        onClick={() => onToggle(item.id, !item.completed)}
      >
        {item.completed ? '✓' : ''}
      </button>

      <CategoryDot category={item.category} />

      <span className="item-text">{item.text}</span>

      <button
        className="item-delete"
        onClick={() => onDelete(item.id)}
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}
