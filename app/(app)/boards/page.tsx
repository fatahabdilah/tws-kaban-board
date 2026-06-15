import { redirect } from 'next/navigation';

// Boards now live inside workspaces. Send the bare /boards index to /workspaces.
export default function BoardsIndex() {
  redirect('/workspaces');
}
