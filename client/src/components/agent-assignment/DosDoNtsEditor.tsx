import { useState } from 'react';
import { Plus, X, ThumbsUp, ThumbsDown } from 'lucide-react';

interface DosDoNtsEditorProps {
  dosRules: string[];
  dontsRules: string[];
  onDosChange: (rules: string[]) => void;
  onDontsChange: (rules: string[]) => void;
}

export const DosDoNtsEditor = ({
  dosRules,
  dontsRules,
  onDosChange,
  onDontsChange,
}: DosDoNtsEditorProps) => {
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');

  const addDo = () => {
    if (newDo.trim()) {
      onDosChange([...dosRules, newDo.trim()]);
      setNewDo('');
    }
  };

  const addDont = () => {
    if (newDont.trim()) {
      onDontsChange([...dontsRules, newDont.trim()]);
      setNewDont('');
    }
  };

  const removeDo = (index: number) => {
    onDosChange(dosRules.filter((_, i) => i !== index));
  };

  const removeDont = (index: number) => {
    onDontsChange(dontsRules.filter((_, i) => i !== index));
  };

  const handleDoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDo();
    }
  };

  const handleDontKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDont();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Do's */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ThumbsUp className="w-5 h-5 text-green-600" />
          <label className="text-sm font-medium text-gray-700">
            Things your agent SHOULD do
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Add rules for behaviors you want your agent to follow.
        </p>

        <div className="space-y-2">
          {dosRules.map((rule, index) => (
            <div
              key={index}
              className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2"
            >
              <span className="text-green-600 font-bold text-sm mt-0.5">+</span>
              <span className="flex-1 text-sm text-green-800">{rule}</span>
              <button
                type="button"
                onClick={() => removeDo(index)}
                className="text-green-600 hover:text-green-700 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newDo}
            onChange={(e) => setNewDo(e.target.value)}
            onKeyDown={handleDoKeyDown}
            placeholder="E.g., Ask clarifying questions..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
          <button
            type="button"
            onClick={addDo}
            disabled={!newDo.trim()}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Don'ts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ThumbsDown className="w-5 h-5 text-red-600" />
          <label className="text-sm font-medium text-gray-700">
            Things your agent should NOT do
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Add rules for behaviors you want your agent to avoid.
        </p>

        <div className="space-y-2">
          {dontsRules.map((rule, index) => (
            <div
              key={index}
              className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2"
            >
              <span className="text-red-600 font-bold text-sm mt-0.5">-</span>
              <span className="flex-1 text-sm text-red-800">{rule}</span>
              <button
                type="button"
                onClick={() => removeDont(index)}
                className="text-red-600 hover:text-red-700 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newDont}
            onChange={(e) => setNewDont(e.target.value)}
            onKeyDown={handleDontKeyDown}
            placeholder="E.g., Give medical advice..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
          <button
            type="button"
            onClick={addDont}
            disabled={!newDont.trim()}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
