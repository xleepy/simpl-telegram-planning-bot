import { ItemRow } from './ItemRow';

interface ItemData {
  id: string;
  text: string;
  completed: boolean;
  completedBy: string | null;
  createdBy: string;
  category: string;
}

interface TodoListProps {
  items: ItemData[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function TodoList({ items, onToggle, onDelete }: TodoListProps) {
  if (items.length === 0) {
    return (
      <div className="todo-empty">
        <p>No items yet. Add one above!</p>
      </div>
    );
  }

  const pending = items.filter((i) => !i.completed);
  const completed = items.filter((i) => i.completed);

  return (
    <div className="todo-list">
      {pending.map((item) => (
        <ItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
      ))}
      {completed.length > 0 && (
        <>
          <div className="section-divider">Completed</div>
          {completed.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </>
      )}
    </div>
  );
}
