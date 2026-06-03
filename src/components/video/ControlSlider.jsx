import React from 'react';
import { Slider } from '@/components/ui/slider';

export default function ControlSlider({ value, min, max, step, onChange }) {
  return (
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step || 1}
      onValueChange={([v]) => onChange(v)}
      className="cursor-pointer"
    />
  );
}