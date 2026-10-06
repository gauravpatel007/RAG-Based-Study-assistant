import { useEffect, useState } from 'react';
export default function ApiNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const listener = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('api-error', listener);
    return () => window.removeEventListener('api-error', listener);
  }, []);
  return message ? <div role="alert" className="api-notice">{message}<button className="btn btn-sm" onClick={() => setMessage('')}>Dismiss</button></div> : null;
}
