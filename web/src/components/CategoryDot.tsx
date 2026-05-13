const COLORS: Record<string, string> = {
  groceries: '#4CAF50',
  gear: '#2196F3',
  tasks: '#FF9800',
  other: '#9E9E9E',
};

interface CategoryDotProps {
  category: string;
}

export function CategoryDot({ category }: CategoryDotProps) {
  const color = COLORS[category] || COLORS.other;

  return (
    <span
      className="category-dot"
      style={{ backgroundColor: color }}
      title={category}
    />
  );
}
