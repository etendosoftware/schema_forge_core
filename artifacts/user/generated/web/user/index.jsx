import UserTable from './UserTable';
import UserForm from './UserForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <UserTable data={[]} />
    </div>
  );
}
