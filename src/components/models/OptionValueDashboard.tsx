import { useState } from 'react';

type SliderProps = {
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
};

function Slider({ label, symbol, value, min, max, step, onChange }: SliderProps) {
  const decimals = step < 1 ? 2 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm text-gray-700">
          <span className="font-mono text-primary-600 mr-2">{symbol}</span>
          {label}
        </label>
        <span className="text-sm font-mono text-gray-900">{value.toFixed(decimals)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary-600"
      />
    </div>
  );
}

type BarProps = {
  label: string;
  value: number;
  scale: number;
  formula: string;
  accent?: boolean;
};

function Bar({ label, value, scale, formula, accent = false }: BarProps) {
  const widthPct = Math.min((Math.abs(value) / scale) * 100, 100);
  const fill = value >= 0
    ? accent ? 'bg-primary-500' : 'bg-gray-400'
    : 'bg-red-300';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-mono text-gray-900">{value.toFixed(1)}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full transition-all ${fill}`} style={{ width: `${widthPct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1 font-mono">{formula}</p>
    </div>
  );
}

export default function OptionValueDashboard() {
  const [G, setG] = useState(60);
  const [B, setB] = useState(40);
  const [E, setE] = useState(30);
  const [C, setC] = useState(20);
  const [w, setW] = useState(0.3);
  const [OV, setOV] = useState(30);

  const evExist = G - B + w * (E - C);
  const evContinue = evExist + OV;
  const scale = Math.max(Math.abs(evExist), Math.abs(evContinue), 10);

  return (
    <div className="not-prose my-10 border border-gray-200 rounded-lg p-6 bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Inputs</h3>
          <div className="space-y-4">
            <Slider symbol="G" label="Expected good" value={G} min={0} max={100} step={1} onChange={setG} />
            <Slider symbol="B" label="Expected bad" value={B} min={0} max={100} step={1} onChange={setB} />
            <Slider symbol="E" label="Externalities (positive)" value={E} min={0} max={100} step={1} onChange={setE} />
            <Slider symbol="C" label="Costs to others" value={C} min={0} max={100} step={1} onChange={setC} />
            <Slider symbol="w" label="Weight on others" value={w} min={0} max={1} step={0.05} onChange={setW} />
            <Slider symbol="OV" label="Option value" value={OV} min={0} max={100} step={1} onChange={setOV} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Output</h3>
          <div className="space-y-6">
            <Bar
              label="Pre-existence EV"
              value={evExist}
              scale={scale}
              formula="G − B + w(E − C)"
            />
            <Bar
              label="In-existence EV"
              value={evContinue}
              scale={scale}
              formula="G − B + w(E − C) + OV"
              accent
            />
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Asymmetry</span>
                <span className="text-sm font-mono text-gray-900">{(evContinue - evExist).toFixed(1)}</span>
              </div>
              <p className="text-xs text-gray-400">
                The structural gap option value creates between starting and continuing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
