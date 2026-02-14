import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { useJobs, useCancelJob, useHandoffComplete } from '../hooks/useJobs';
import api from '../services/api';
import toast from 'react-hot-toast';

const WS_URL = import.meta.env.VITE_WS_URL || '';
const API_URL = import.meta.env.VITE_API_URL || '';

function proxyScreenshotUrl(url) {
  if (!url) return url;
  const bucket = 'crop-spray-uploads';
  const idx = url.indexOf(`/${bucket}/`);
  if (idx !== -1) {
    const key = url.substring(idx + bucket.length + 2);
    return `${API_URL}/api/screenshots/${key}`;
  }
  return url;
}

const SUGGESTIONS = [
  'Take a screenshot of https://example.com',
  'Go to Amazon and find the cheapest laptop under $500',
  'Scrape the top 10 posts from Hacker News',
  'Fill out the contact form at https://example.com/contact',
  'Monitor the price of a product on any e-commerce site',
];

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatAgent() {
  const { user } = useAuth();
  const cancelJob = useCancelJob();
  const handoffComplete = useHandoffComplete();
  const { data: jobsData } = useJobs({ limit: 50 });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [activeJobId, setActiveJobId] = useState(null);
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [handoffPending, setHandoffPending] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!user) return;

    const socket = io(WS_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_user', user.id);
    });

    socket.on('job_updated', (data) => {
      if (data.status === 'processing') {
        setIsAgentWorking(true);
      }

      if (data.logs && data.logs.length > 0) {
        data.logs.forEach((log) => {
          setMessages((prev) => [...prev, {
            type: 'agent_log',
            content: typeof log === 'string' ? log : JSON.stringify(log),
            timestamp: new Date(),
            jobId: data.jobId,
          }]);
        });
      }

      if (data.screenshots && data.screenshots.length > 0) {
        data.screenshots.forEach((url) => {
          setMessages((prev) => [...prev, {
            type: 'screenshot',
            content: url,
            timestamp: new Date(),
            jobId: data.jobId,
          }]);
        });
      }

      if (data.status === 'completed') {
        setIsAgentWorking(false);
        setActiveJobId(null);
        setMessages((prev) => [...prev, {
          type: 'agent_complete',
          content: data.result ? JSON.stringify(data.result, null, 2) : 'Task completed successfully.',
          timestamp: new Date(),
          jobId: data.jobId,
          executionTime: data.executionTime,
        }]);
      }

      if (data.status === 'failed') {
        setIsAgentWorking(false);
        setActiveJobId(null);
        setMessages((prev) => [...prev, {
          type: 'agent_error',
          content: data.error || 'Task failed. Please try again.',
          timestamp: new Date(),
          jobId: data.jobId,
        }]);
      }
    });

    socket.on('handoff_requested', (data) => {
      setHandoffPending(data);
      setMessages((prev) => [...prev, {
        type: 'handoff',
        content: data.reason || 'CAPTCHA or OTP detected. Please solve it and click "Resume" below.',
        timestamp: new Date(),
        jobId: data.jobId,
      }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isAgentWorking) return;

    setInput('');
    setMessages((prev) => [...prev, {
      type: 'user',
      content: text,
      timestamp: new Date(),
    }]);

    setMessages((prev) => [...prev, {
      type: 'agent_thinking',
      content: 'Starting browser agent...',
      timestamp: new Date(),
    }]);

    setIsAgentWorking(true);

    try {
      const { data } = await api.post('/jobs', {
        name: text.slice(0, 80),
        taskDescription: text,
        priority: 5,
      });

      const job = data.job;
      setActiveJobId(job.id);

      setMessages((prev) => {
        const updated = [...prev];
        const thinkingIdx = updated.findLastIndex((m) => m.type === 'agent_thinking');
        if (thinkingIdx >= 0) {
          updated[thinkingIdx] = {
            type: 'agent_status',
            content: 'Task queued. Browser agent is starting up...',
            timestamp: new Date(),
            jobId: job.id,
          };
        }
        return updated;
      });

      if (socketRef.current) {
        socketRef.current.emit('join_job', job.id);
      }
    } catch (err) {
      setIsAgentWorking(false);
      setMessages((prev) => {
        const updated = [...prev];
        const thinkingIdx = updated.findLastIndex((m) => m.type === 'agent_thinking');
        if (thinkingIdx >= 0) {
          updated[thinkingIdx] = {
            type: 'agent_error',
            content: err.response?.data?.error || 'Failed to create task. Please try again.',
            timestamp: new Date(),
          };
        }
        return updated;
      });
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    try {
      await cancelJob.mutateAsync(activeJobId);
      setIsAgentWorking(false);
      setActiveJobId(null);
      setMessages((prev) => [...prev, {
        type: 'system',
        content: 'Task canceled.',
        timestamp: new Date(),
      }]);
    } catch (err) {
      toast.error('Failed to cancel task');
    }
  };

  const handleHandoffResolved = async () => {
    if (!handoffPending) return;
    try {
      await handoffComplete.mutateAsync(handoffPending.jobId);
      setHandoffPending(null);
      setMessages((prev) => [...prev, {
        type: 'system',
        content: 'Resuming browser agent...',
        timestamp: new Date(),
      }]);
    } catch (err) {
      toast.error('Failed to resume agent');
    }
  };

  const handleSuggestionClick = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadJobHistory = (job) => {
    const historyMessages = [];
    historyMessages.push({
      type: 'user',
      content: job.taskDescription || job.name,
      timestamp: new Date(job.createdAt),
    });

    if (job.logs) {
      job.logs.forEach((log) => {
        historyMessages.push({
          type: 'agent_log',
          content: typeof log === 'string' ? log : JSON.stringify(log),
          timestamp: new Date(job.startedAt || job.createdAt),
          jobId: job.id,
        });
      });
    }

    if (job.screenshots) {
      job.screenshots.forEach((url) => {
        historyMessages.push({
          type: 'screenshot',
          content: url,
          timestamp: new Date(job.startedAt || job.createdAt),
          jobId: job.id,
        });
      });
    }

    if (job.status === 'completed') {
      historyMessages.push({
        type: 'agent_complete',
        content: job.result ? JSON.stringify(job.result, null, 2) : 'Task completed.',
        timestamp: new Date(job.completedAt || job.createdAt),
        jobId: job.id,
        executionTime: job.executionTime,
      });
    } else if (job.status === 'failed') {
      historyMessages.push({
        type: 'agent_error',
        content: job.error || 'Task failed.',
        timestamp: new Date(job.completedAt || job.createdAt),
        jobId: job.id,
      });
    }

    setMessages(historyMessages);
    setShowHistory(false);
  };

  const pastJobs = jobsData?.jobs || [];

  return (
    <div className="flex h-full">
      <div className={`${showHistory ? 'w-80 border-r border-gray-800' : 'w-0'} transition-all duration-200 overflow-hidden bg-gray-900/50 flex flex-col shrink-0`}>
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">History</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {pastJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => loadJobHistory(job)}
              className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50"
            >
              <p className="text-sm text-gray-200 truncate">{job.taskDescription || job.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  job.status === 'completed' ? 'bg-green-400' :
                  job.status === 'failed' ? 'bg-red-400' :
                  job.status === 'processing' ? 'bg-blue-400 animate-pulse' :
                  'bg-gray-500'
                }`} />
                <span className="text-xs text-gray-500">{job.status}</span>
                <span className="text-xs text-gray-600">{formatTime(job.createdAt)}</span>
              </div>
            </button>
          ))}
          {pastJobs.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No previous tasks</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
              title="Toggle history"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-semibold text-white">AutomateFlow Agent</h2>
              <p className="text-xs text-gray-500">
                {isAgentWorking ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Working...
                  </span>
                ) : 'Ready'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAgentWorking && (
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={() => { setMessages([]); setActiveJobId(null); setIsAgentWorking(false); }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              New Chat
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">What would you like to automate?</h1>
              <p className="text-gray-400 text-sm mb-8 text-center">
                Describe a task in natural language and the AI agent will execute it in a real browser.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-left px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300 hover:border-primary-500/50 hover:bg-gray-800 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
              {isAgentWorking && messages[messages.length - 1]?.type !== 'agent_thinking' && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary-600/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              {handoffPending && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-300 mb-1">Human Intervention Required</p>
                      <p className="text-xs text-amber-200/70 mb-3">
                        The browser agent detected a CAPTCHA or verification step. Please solve it and click Resume.
                      </p>
                      <button
                        onClick={handleHandoffResolved}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                      >
                        I solved it - Resume Agent
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 bg-gray-900/30 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isAgentWorking}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50"
                  placeholder={isAgentWorking ? 'Agent is working...' : 'Describe what you want the browser agent to do...'}
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isAgentWorking}
                  className="absolute right-2 bottom-2 p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors disabled:opacity-30 disabled:hover:bg-primary-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">
              The AI agent will execute tasks in a real browser. Be specific about what you need.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }) {
  const { type, content, timestamp, executionTime } = message;

  if (type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="bg-primary-600 rounded-2xl rounded-br-md px-4 py-3">
            <p className="text-sm text-white whitespace-pre-wrap">{content}</p>
          </div>
          <p className="text-xs text-gray-600 mt-1 text-right">{formatTime(timestamp)}</p>
        </div>
      </div>
    );
  }

  if (type === 'agent_thinking') {
    return (
      <div className="flex gap-3">
        <AgentAvatar />
        <div className="py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-500">{content}</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'agent_status') {
    return (
      <div className="flex gap-3">
        <AgentAvatar />
        <div className="bg-gray-800/50 rounded-2xl rounded-bl-md px-4 py-3">
          <p className="text-sm text-gray-300">{content}</p>
          <p className="text-xs text-gray-600 mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    );
  }

  if (type === 'agent_log') {
    return (
      <div className="flex gap-3">
        <div className="w-7 shrink-0" />
        <div className="flex items-start gap-2 py-0.5">
          <svg className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <p className="text-xs text-gray-400 font-mono">{content}</p>
        </div>
      </div>
    );
  }

  if (type === 'screenshot') {
    return (
      <div className="flex gap-3">
        <div className="w-7 shrink-0" />
        <div className="max-w-md">
          <div className="rounded-xl overflow-hidden border border-gray-800 bg-black">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-gray-500">Browser Screenshot</span>
            </div>
              <a href={proxyScreenshotUrl(content)} target="_blank" rel="noopener noreferrer">
                <img src={proxyScreenshotUrl(content)} alt="Browser screenshot" className="w-full" loading="lazy" />
              </a>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'agent_complete') {
    return (
      <div className="flex gap-3">
        <AgentAvatar status="success" />
        <div className="flex-1 max-w-[80%]">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-green-400">Task Complete</span>
              {executionTime && (
                <span className="text-xs text-green-400/60">({(executionTime / 1000).toFixed(1)}s)</span>
              )}
            </div>
            <pre className="text-xs text-green-300/80 whitespace-pre-wrap font-mono overflow-x-auto">{content}</pre>
          </div>
          <p className="text-xs text-gray-600 mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    );
  }

  if (type === 'agent_error') {
    return (
      <div className="flex gap-3">
        <AgentAvatar status="error" />
        <div className="flex-1 max-w-[80%]">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-medium text-red-400">Task Failed</span>
            </div>
            <p className="text-sm text-red-300/80">{content}</p>
          </div>
          <p className="text-xs text-gray-600 mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    );
  }

  if (type === 'handoff') {
    return (
      <div className="flex gap-3">
        <AgentAvatar status="warning" />
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%]">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
            <span className="text-sm font-medium text-amber-400">Needs Your Help</span>
          </div>
          <p className="text-sm text-amber-300/80">{content}</p>
        </div>
      </div>
    );
  }

  if (type === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-600 bg-gray-800/50 px-3 py-1 rounded-full">{content}</span>
      </div>
    );
  }

  return null;
}

function AgentAvatar({ status }) {
  const colors = {
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
    warning: 'bg-amber-500/20 text-amber-400',
  };

  const colorClass = colors[status] || 'bg-primary-600/20 text-primary-400';

  return (
    <div className={`w-7 h-7 rounded-full ${colorClass} flex items-center justify-center shrink-0 mt-0.5`}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  );
}
