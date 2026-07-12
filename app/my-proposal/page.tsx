import { redirect } from 'next/navigation';

// This route was renamed to /my-profile. Kept as a redirect (rather than
// deleted outright) so any old bookmarked or previously-indexed links to
// /my-proposal still land somewhere real instead of 404ing.
export default function MyProposalRedirect() {
  redirect('/my-profile');
}
