interface OnlineUser {
  userId: string;
  firstName: string;
}

interface PresenceBarProps {
  users: OnlineUser[];
  currentUser: string;
}

export function PresenceBar({ users, currentUser }: PresenceBarProps) {
  if (users.length === 0) return null;

  return (
    <div className="presence-bar">
      {users.map((u) => (
        <span
          key={u.userId}
          className={`presence-dot ${u.firstName === currentUser ? 'presence-you' : ''}`}
          title={u.firstName === currentUser ? 'You' : u.firstName}
        >
          {u.firstName[0]?.toUpperCase() || '?'}
        </span>
      ))}
      <span className="presence-count">
        {users.length} online
      </span>
    </div>
  );
}
