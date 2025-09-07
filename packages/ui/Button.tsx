import { ButtonProps } from './index';

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', cursor: 'pointer' }}>
      {children}
    </button>
  );
}