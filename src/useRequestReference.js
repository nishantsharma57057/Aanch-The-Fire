import {useEffect, useState} from 'react';

// Hash routes keep hosting rewrites unnecessary; the query selects an admin record.
export function useRequestReference(enabled = true) {
  const read = () => enabled ? new URLSearchParams(location.hash.split('?')[1] || '').get('ref') || '' : '';
  const [reference, setReference] = useState(read);
  useEffect(() => {
    const changed = () => setReference(read());
    changed(); window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, [enabled]);
  return [reference, setReference];
}
