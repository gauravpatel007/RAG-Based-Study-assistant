import { useEffect, useState } from 'react';

export default function DebugLayout() {
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const checkLayout = () => {
      const getRect = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return 'Not found';
        const rect = el.getBoundingClientRect();
        return `${Math.round(rect.width)}x${Math.round(rect.height)} @ x:${Math.round(rect.left)}`;
      };

      const info = [
        `window: ${window.innerWidth}x${window.innerHeight}`,
        `body: ${getRect('body')}`,
        `#root: ${getRect('#root')}`,
        `.app-layout: ${getRect('.app-layout')} | d:${document.querySelector('.app-layout') ? getComputedStyle(document.querySelector('.app-layout')!).display : ''}`,
        `.sidebar: ${getRect('.sidebar')} | pos:${document.querySelector('.sidebar') ? getComputedStyle(document.querySelector('.sidebar')!).position : ''} | w:${document.querySelector('.sidebar') ? getComputedStyle(document.querySelector('.sidebar')!).width : ''}`,
        `.main-content: ${getRect('.main-content')} | ml:${document.querySelector('.main-content') ? getComputedStyle(document.querySelector('.main-content')!).marginLeft : ''} | pos:${document.querySelector('.main-content') ? getComputedStyle(document.querySelector('.main-content')!).position : ''}`,
        `.page-content: ${getRect('.page-content')} | w:${document.querySelector('.page-content') ? getComputedStyle(document.querySelector('.page-content')!).width : ''}`,
        `--sidebar-width: ${getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')}`
      ].join('\n');

      setDebugInfo(info);
    };

    const timer = setInterval(checkLayout, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: 'lime',
      padding: '10px',
      fontFamily: 'monospace',
      zIndex: 99999,
      whiteSpace: 'pre',
      pointerEvents: 'none'
    }}>
      {debugInfo}
    </div>
  );
}
