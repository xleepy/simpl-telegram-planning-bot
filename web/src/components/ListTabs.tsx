interface ListTabsProps {
  lists: { id: string; name: string }[];
  activeListId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ListTabs({ lists, activeListId, onSelect, onCreate }: ListTabsProps) {
  return (
    <div className="list-tabs">
      <div className="tabs-scroll">
        {lists.map((list) => (
          <button
            key={list.id}
            className={`tab ${list.id === activeListId ? 'tab-active' : ''}`}
            onClick={() => onSelect(list.id)}
          >
            {list.name}
          </button>
        ))}
      </div>
      <button className="tab-add" onClick={onCreate} title="New list">
        +
      </button>
    </div>
  );
}
