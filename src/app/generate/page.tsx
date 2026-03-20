'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineConfig, ParsedBrief, Outline } from '@/lib/pipeline/types';

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

type Stage = 'idle' | 'parsing' | 'outlining' | 'drafting' | 'paraphrasing' | 'polishing' | 'detecting' | 'iterating' | 'complete' | 'error';

const STAGES = [
  { key: 'parsing', label: 'Parse Brief', description: 'Analyzing assignment requirements' },
  { key: 'outlining', label: 'Create Outline', description: 'Designing section structure' },
  { key: 'drafting', label: 'Generate Draft', description: 'Writing full assignment' },
  { key: 'paraphrasing', label: 'Humanize', description: 'Adversarial vocabulary disruption' },
  { key: 'polishing', label: 'Polish', description: 'ESL markers & cleanup' },
] as const;

export default function GeneratePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parsedBrief, setParsedBrief] = useState<ParsedBrief | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [fullDraft, setFullDraft] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const [polishStats, setPolishStats] = useState<Record<string, unknown> | null>(null);
  const [displayText, setDisplayText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [draftProgress, setDraftProgress] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const config = useRef<PipelineConfig | null>(null);
  const briefText = useRef<string>('');

  useEffect(() => {
    // Auth check first
    if (sessionStorage.getItem('authenticated') !== 'true') {
      router.push('/login');
      return;
    }

    const stored = sessionStorage.getItem('config');
    const brief = sessionStorage.getItem('briefText');
    if (!stored || !brief) {
      router.push('/');
      return;
    }
    config.current = JSON.parse(stored);
    briefText.current = brief;

    if (!hasStarted.current) {
      hasStarted.current = true;
      runPipeline();
    }

    return () => {
      // Cancel in-flight requests on unmount
      abortControllerRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn user before leaving during pipeline execution
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage !== 'idle' && stage !== 'complete' && stage !== 'error') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stage]);

  /** Helper: fetch an API route and throw a descriptive error if it fails */
  const apiFetch = async (url: string, body: Record<string, unknown>, stageName: string, signal?: AbortSignal) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      let detail = `Failed at "${stageName}" (HTTP ${res.status})`;
      try {
        const errData = await res.json();
        if (errData.error) detail = errData.error;
        if (errData.code === 'INVALID_API_KEY' || errData.code === 'NO_API_KEY') {
          detail += '\n\nGo back and click the ⚙ gear icon to update your API key.';
        }
        if (errData.code === 'INSUFFICIENT_FUNDS') {
          detail += '\n\nVisit console.anthropic.com to add credits.';
        }
      } catch { /* response wasn't JSON */ }
      throw new Error(detail);
    }
    return res.json();
  };

  const runPipeline = async () => {
    // Cancel any previous in-flight requests
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      const userApiKey = sessionStorage.getItem('apiKey') || localStorage.getItem('anthropic_api_key') || '';

      if (!userApiKey) {
        throw new Error('No API key found. Go back and click the ⚙ gear icon (top-right) to set your Anthropic API key.');
      }

      // Stage 1: Parse brief
      setStage('parsing');
      const parsed: ParsedBrief = await apiFetch('/api/parse-brief', { briefText: briefText.current, apiKey: userApiKey }, 'Parse Brief', signal);
      setParsedBrief(parsed);

      // Stage 2: Generate outline
      setStage('outlining');
      const outlineData: Outline = await apiFetch('/api/generate-outline', { brief: parsed, config: config.current, apiKey: userApiKey }, 'Generate Outline', signal);
      setOutline(outlineData);

      // Stage 3: Generate draft (single pass)
      setStage('drafting');
      setDraftProgress('Generating full draft in single pass...');
      const draftData = await apiFetch('/api/generate-draft', { outline: outlineData, config: config.current, apiKey: userApiKey }, 'Generate Draft', signal);
      let draft = draftData.fullDraft as string;
      setFullDraft(draft);
      setDisplayText(draft);
      setDraftProgress(`Generated ${draftData.wordCount} words`);

      // Stage 4: Adversarial Paraphrase
      setStage('paraphrasing');
      setDraftProgress('Rewriting with vocabulary disruption...');
      const paraphraseData = await apiFetch('/api/paraphrase', { draft, apiKey: userApiKey }, 'Humanize', signal);
      const paraphrasedText = paraphraseData.paraphrasedText as string;
      setDisplayText(paraphrasedText);
      setDraftProgress(`Paraphrased: ${paraphraseData.wordCount} words`);

      // Stage 5: Polish (programmatic, NO LLM — fast)
      setStage('polishing');
      const polishData = await apiFetch('/api/polish', { draft: paraphrasedText || draft }, 'Polish', signal);
      setPolishedText(polishData.polishedText);
      setPolishStats(polishData.stats);
      setDisplayText(polishData.polishedText);

      // Detection/iteration commented out — not needed, user tests on stealthwriter.ai manually
      // ZeroGPT scores don't correlate with StealthWriter strict mode

      setStage('complete');
    } catch (err) {
      if (signal.aborted) return; // Don't show error if we intentionally cancelled
      setError(err instanceof Error ? err.message : 'Pipeline failed');
      setStage('error');
    }
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      const text = polishedText || displayText;
      const title = parsedBrief?.title || 'Assignment';
      const res = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, title, config: config.current }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Assignment';
      a.download = `${safeTitle}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export document');
    } finally {
      setIsExporting(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopyText = useCallback(() => {
    const text = polishedText || displayText;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        // Fallback for non-HTTPS
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [polishedText, displayText]);

  const handleRegenerate = () => {
    setStage('idle');
    setError(null);
    setParsedBrief(null);
    setOutline(null);
    setFullDraft('');
    setPolishedText('');
    setPolishStats(null);
    setDisplayText('');
    setDraftProgress('');
    runPipeline();
  };

  const getStageStatus = (stageKey: string): 'pending' | 'active' | 'complete' | 'error' => {
    const stageOrder = ['parsing', 'outlining', 'drafting', 'paraphrasing', 'polishing'];
    const currentIdx = stageOrder.indexOf(stage === 'iterating' ? 'detecting' : stage);
    const checkIdx = stageOrder.indexOf(stageKey);

    if (stage === 'error') {
      if (checkIdx <= currentIdx) return checkIdx === currentIdx ? 'error' : 'complete';
      return 'pending';
    }
    if (stage === 'complete') return 'complete';
    if (checkIdx < currentIdx) return 'complete';
    if (checkIdx === currentIdx) return 'active';
    return 'pending';
  };

  const wordCount = (polishedText || displayText).split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <img src="/logo.png" alt="Humanizer" className="h-10 w-auto" />
            <h1 className="text-xl font-bold text-white">Humanizer</h1>
          </div>
          <div className="flex items-center gap-4" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Left Sidebar: Pipeline Progress */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Pipeline</h2>
            <div className="space-y-2">
              {STAGES.map((s) => {
                const status = getStageStatus(s.key);
                return (
                  <div
                    key={s.key}
                    className={`p-3 rounded-lg border transition-all ${
                      status === 'active'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : status === 'complete'
                        ? 'border-green-800 bg-green-900/10'
                        : status === 'error'
                        ? 'border-red-800 bg-red-900/10'
                        : 'border-gray-800 bg-gray-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        status === 'active'
                          ? 'bg-indigo-500 text-white animate-pulse'
                          : status === 'complete'
                          ? 'bg-green-600 text-white'
                          : status === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {status === 'complete' ? '✓' : status === 'error' ? '!' : status === 'active' ? '⋯' : '•'}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          status === 'active' ? 'text-indigo-300' :
                          status === 'complete' ? 'text-green-300' :
                          status === 'error' ? 'text-red-300' :
                          'text-gray-500'
                        }`}>
                          {s.label}
                        </div>
                        {status === 'active' && (s.key === 'drafting' || s.key === 'paraphrasing') && draftProgress && (
                          <div className="text-xs text-gray-400 mt-0.5">{draftProgress}</div>
                        )}
                        {/* Detection UI removed — user tests on stealthwriter.ai */}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 rounded-lg border border-red-800 bg-red-900/20 space-y-3">
                <div className="text-sm font-medium text-red-300">Something went wrong</div>
                <div className="text-sm text-red-200/80 whitespace-pre-line">{error}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push('/')}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs cursor-pointer"
                  >
                    ← Go Back
                  </button>
                  <button
                    onClick={handleRegenerate}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Outline Preview */}
            {outline && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Outline</h3>
                <div className="space-y-1">
                  {outline.sections.map((s, i) => (
                    <div key={i} className="text-xs text-gray-400 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        stage === 'complete' || stage === 'polishing' || stage === 'detecting' || stage === 'iterating'
                          ? 'bg-green-500'
                          : stage === 'drafting' ? 'bg-indigo-500 animate-pulse' : 'bg-gray-700'
                      }`} />
                      <span className="truncate">{s.title}</span>
                      <span className="text-gray-600 text-[10px] ml-auto">~{s.targetWords}w</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Polish Stats */}
            {polishStats && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fingerprint Stats</h3>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>&quot;The&quot; starters</span>
                    <span className={(polishStats as { theStarterPercentage: number }).theStarterPercentage >= 20 ? 'text-green-400' : 'text-yellow-400'}>
                      {(polishStats as { theStarterPercentage: number }).theStarterPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg sent/para</span>
                    <span className={(polishStats as { avgSentencesPerParagraph: number }).avgSentencesPerParagraph <= 2.5 ? 'text-green-400' : 'text-yellow-400'}>
                      {(polishStats as { avgSentencesPerParagraph: number }).avgSentencesPerParagraph}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passive voice</span>
                    <span>{(polishStats as { passiveVoicePercentage: number }).passiveVoicePercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Banned removed</span>
                    <span>{(polishStats as { bannedPhrasesRemoved: number }).bannedPhrasesRemoved}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {stage === 'complete' && (
              <div className="space-y-2 mt-3">
                <button
                  onClick={handleCopyText}
                  className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  onClick={handleExportDocx}
                  disabled={isExporting}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white rounded-lg text-sm transition-colors cursor-pointer"
                >
                  {isExporting ? 'Exporting...' : 'Export as .docx'}
                </button>
                <button
                  onClick={handleRegenerate}
                  className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Main Content: Output */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                {stage === 'complete' ? 'Generated Text' : 'Output'}
              </h2>
              {wordCount > 0 && (
                <span className="text-xs text-gray-500">{wordCount.toLocaleString()} words</span>
              )}
            </div>

            <div
              ref={outputRef}
              className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl p-6 overflow-y-auto min-h-[400px] max-h-[calc(100vh-280px)]"
            >
              {!displayText && stage !== 'error' && (
                <div className="flex items-center justify-center h-full text-gray-600">
                  <div className="text-center space-y-3">
                    <div className="text-4xl animate-pulse">⋯</div>
                    <p className="text-sm">
                      {stage === 'parsing' && 'Analyzing your assignment brief...'}
                      {stage === 'outlining' && 'Creating section structure...'}
                      {stage === 'drafting' && 'Writing full assignment in single pass...'}
                      {stage === 'paraphrasing' && 'Rewriting with vocabulary disruption...'}
                      {stage === 'polishing' && 'Applying ESL markers and cleanup...'}
                      {stage === 'detecting' && 'Checking per-paragraph AI detection scores...'}
                      {stage === 'iterating' && 'Regenerating flagged paragraphs...'}
                      {stage === 'idle' && 'Initializing...'}
                    </p>
                  </div>
                </div>
              )}

              {displayText && (
                <div className="prose prose-invert prose-sm max-w-none">
                  {displayText.split(/\n\n+/).map((block, i) => {
                    const trimmed = block.trim();
                    if (!trimmed) return null;
                    if (trimmed.match(/^#{1,3}\s/) || (trimmed.match(/^\d+(\.\d+)*\.?\s/) && countWords(trimmed) < 20)) {
                      return (
                        <h2 key={i} className="text-base font-semibold text-white mt-5 mb-2 first:mt-0">
                          {trimmed.replace(/^#{1,3}\s/, '')}
                        </h2>
                      );
                    }
                    return (
                      <p key={i} className="text-gray-300 leading-relaxed mb-3 text-sm">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tip to verify on StealthWriter */}
            {stage === 'complete' && (
              <div className="mt-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl">
                <p className="text-xs text-gray-400">
                  Verify your text at{' '}
                  <a href="https://stealthwriter.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">stealthwriter.ai</a>
                  {' '}(strict mode) to confirm human score.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="border-t border-gray-800 px-6 py-2 text-center">
        <span className="text-xs text-gray-500">Built by <a href="https://www.linkedin.com/in/husam-hammami/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">Husam Hammami</a></span>
      </footer>
    </div>
  );
}
