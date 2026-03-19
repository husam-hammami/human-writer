'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineConfig } from '@/lib/pipeline/types';

export default function HomePage() {
  const router = useRouter();
  const [briefText, setBriefText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [config, setConfig] = useState<PipelineConfig>({
    tone: 'academic-formal',
    academicLevel: 'postgraduate',
    wordCount: 4000,
    citationStyle: 'chicago-18th',
    discipline: 'Marketing',
  });

  // Auth check
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('authenticated') !== 'true') {
      router.push('/login');
    }
    // Load saved API key
    const saved = localStorage.getItem('anthropic_api_key');
    if (saved) setApiKey(saved);
  }, [router]);

  const handleSaveApiKey = () => {
    localStorage.setItem('anthropic_api_key', apiKey);
    setShowSettings(false);
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      alert('Please upload a .docx file');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-brief', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) {
        setBriefText(data.text);
      } else {
        alert('Failed to parse file: ' + (data.error || 'Unknown error'));
      }
    } catch {
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleGenerate = () => {
    if (!briefText.trim()) {
      alert('Please enter or upload an assignment brief');
      return;
    }
    const savedKey = localStorage.getItem('anthropic_api_key');
    if (!savedKey) {
      setShowSettings(true);
      alert('Please set your Anthropic API key first');
      return;
    }
    sessionStorage.setItem('briefText', briefText);
    sessionStorage.setItem('config', JSON.stringify(config));
    sessionStorage.setItem('apiKey', savedKey);
    router.push('/generate');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Your key is stored locally in your browser. Never sent to our servers.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveApiKey} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm cursor-pointer">Save</button>
              <button onClick={() => setShowSettings(false)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header className="px-6 pt-3 pb-1 relative">
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-6 p-2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-1">
          <img src="/logo.png" alt="Humanizer" className="h-40 w-auto drop-shadow-[0_0_60px_rgba(99,102,241,0.5)]" />
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Humanizer</h1>
            <p className="text-xs text-gray-400 mt-0.5">AI-Powered Academic Writing &middot; 90%+ Human Detection Score</p>
          </div>
        </div>
      </header>

      <div className="border-b border-gray-800 mx-6" />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Brief Input */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Assignment Brief</h2>
              <p className="text-sm text-gray-400 mb-4">
                Paste your assignment instructions below or upload a .docx file
              </p>
            </div>

            {/* File Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.docx';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileUpload(file);
                };
                input.click();
              }}
            >
              {isUploading ? (
                <div className="text-indigo-400">Parsing document...</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-gray-400 text-3xl">+</div>
                  <div className="text-gray-400 text-sm">
                    Drop .docx file here or click to upload
                  </div>
                </div>
              )}
            </div>

            {/* Text Area */}
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder={`Paste your full assignment brief, rubric, and any additional instructions here...

Include:
- Assignment description and requirements
- Marking rubric or criteria
- Word count / page limits
- Any specific formatting requirements
- Topics or sections that must be covered`}
              className="w-full h-80 bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-200 text-sm resize-none placeholder:text-gray-600 focus:border-indigo-500 transition-colors"
            />

            <div className="text-xs text-gray-500 text-right">
              {briefText.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {/* Right: Configuration Panel */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Configuration</h2>
              <p className="text-sm text-gray-400 mb-4">Customize the output</p>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Writing Tone</label>
              <select
                value={config.tone}
                onChange={(e) => setConfig({ ...config, tone: e.target.value as PipelineConfig['tone'] })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-indigo-500"
              >
                <option value="academic-formal">Academic Formal</option>
                <option value="academic-conversational">Academic Conversational</option>
                <option value="reflective">Reflective</option>
                <option value="casual-analytical">Casual Analytical</option>
              </select>
            </div>

            {/* Academic Level */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Academic Level</label>
              <select
                value={config.academicLevel}
                onChange={(e) => setConfig({ ...config, academicLevel: e.target.value as PipelineConfig['academicLevel'] })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-indigo-500"
              >
                <option value="undergraduate">Undergraduate</option>
                <option value="postgraduate">Postgraduate</option>
                <option value="doctoral">Doctoral</option>
              </select>
            </div>

            {/* Word Count */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Word Count: <span className="text-indigo-400">{config.wordCount.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min={500}
                max={10000}
                step={100}
                value={config.wordCount}
                onChange={(e) => setConfig({ ...config, wordCount: parseInt(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>500</span>
                <span>10,000</span>
              </div>
            </div>

            {/* Citation Style */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Citation Style</label>
              <select
                value={config.citationStyle}
                onChange={(e) => setConfig({ ...config, citationStyle: e.target.value as PipelineConfig['citationStyle'] })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-indigo-500"
              >
                <option value="chicago-18th">Chicago 18th</option>
                <option value="apa-7th">APA 7th</option>
                <option value="harvard">Harvard</option>
                <option value="mla">MLA</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Discipline */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Subject Discipline</label>
              <input
                type="text"
                value={config.discipline}
                onChange={(e) => setConfig({ ...config, discipline: e.target.value })}
                placeholder="e.g., Marketing, Finance, Psychology"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-indigo-500"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!briefText.trim()}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
            >
              Generate Human-Like Text
            </button>

            {/* Info Box */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-400 space-y-2">
              <p className="font-medium text-gray-300">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Parses your assignment brief</li>
                <li>Creates a structured outline</li>
                <li>Generates full draft (single pass)</li>
                <li>Adversarial paraphrase (vocabulary disruption)</li>
                <li>ESL polish &amp; cleanup</li>
                <li>AI detection &amp; targeted iteration</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t border-gray-800 px-6 py-2 text-center">
        <span className="text-xs text-gray-500">Built by <a href="https://www.linkedin.com/in/husam-hammami/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">Husam Hammami</a></span>
      </footer>
    </div>
  );
}
