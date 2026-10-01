import { ChevronDown, Copy, FolderOpen, Maximize2, Minimize2, TerminalSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUI } from '../../components/ui';
import type { Service } from '../../data/mock';

const FILES = ['Caddyfile', 'dist/', 'index.html', 'node_modules/', 'package-lock.json', 'package.json', 'public/', 'src/', 'vite.config.js'];

function respond(cmd: string, service: Service): string[] {
  const [bin, ...args] = cmd.trim().split(/\s+/);
  switch (bin) {
    case '':
      return [];
    case 'help':
      return ['Available: ls, pwd, whoami, node -v, env, cat package.json, uptime, clear'];
    case 'ls':
      return [FILES.join('  ')];
    case 'pwd':
      return ['/app'];
    case 'whoami':
      return ['root'];
    case 'uptime':
      return [' 21:27:04 up 1 day, 52 min,  0 users,  load average: 0.00, 0.01, 0.00'];
    case 'node':
      return args[0] === '-v' || args[0] === '--version' ? ['v24.21.0'] : ['Welcome to Node.js v24.21.0. (interactive mode is not available here)'];
    case 'env':
      return [
        `LIKELION_SERVICE_NAME=${service.name}`,
        'LIKELION_ENVIRONMENT=production',
        `LIKELION_PUBLIC_DOMAIN=${service.domain ?? ''}`,
        'PORT=8080',
        'HOME=/root',
      ];
    case 'cat':
      if (args[0] === 'package.json')
        return ['{', `  "name": "${service.name}",`, '  "private": true,', '  "scripts": { "build": "vite build" }', '}'];
      return [`cat: ${args[0] ?? ''}: No such file or directory`];
    default:
      return [`sh: ${bin}: command not found`];
  }
}

export function ServiceConsole({ service }: { service: Service }) {
  const { toast } = useUI();
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [full, setFull] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt = 'root@ffc5d099cd4b:/app#';
  const online = service.state === 'online';

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  if (!online) {
    return (
      <div className="console-offline">
        <TerminalSquare size={20} />
        <p>Console is unavailable</p>
        <span>Start a deployment to open a shell into a running replica.</span>
      </div>
    );
  }

  const run = () => {
    const cmd = input;
    setInput('');
    if (cmd.trim() === 'clear') {
      setLines([]);
      return;
    }
    setLines((l) => [...l, `${prompt} ${cmd}`, ...respond(cmd, service)]);
  };

  return (
    <div className={`console${full ? ' full' : ''}`}>
      <div className="console-bar">
        <button type="button" className="console-replica">
          <span className="mono">6521d164</span>
          <ChevronDown size={14} />
        </button>
        <div className="console-bar-right">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(`likelion ssh --service ${service.name}`);
              toast('SSH command copied');
            }}
          >
            <Copy size={14} />
            Copy SSH command
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFull((v) => !v)}>
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {full ? 'Exit full screen' : 'Full screen'}
          </button>
          <span className="console-status">
            <span className="pc-dot" /> Connected
          </span>
        </div>
      </div>
      <div className="console-main">
        <div className="console-term" ref={bodyRef} onClick={() => inputRef.current?.focus()}>
          {lines.map((l, i) => (
            <div key={i} className="console-line">
              {l}
            </div>
          ))}
          <div className="console-line console-input-line">
            <span>{prompt}</span>
            <input
              ref={inputRef}
              autoFocus
              value={input}
              spellCheck={false}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              aria-label="Terminal input"
            />
          </div>
        </div>
        {filesOpen && (
          <div className="console-files">
            {FILES.map((f) => (
              <div key={f} className="console-file mono">
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="console-files-btn" onClick={() => setFilesOpen((v) => !v)}>
        <FolderOpen size={14} /> Files
      </button>
    </div>
  );
}
