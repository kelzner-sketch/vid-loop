import React from 'react';
import { Slider } from '@/components/ui/slider';

export default function ControlSlider({ label, value, min, max, step, onChange, unit, icon: Icon }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <span className="text-sm font-mono font-medium text-foreground">
          {value}{unit || ''}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step || 1}
        onValueChange={([v]) => onChange(v)}
        className="cursor-pointer"
      />
    </div>
  );
}