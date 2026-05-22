import type { ChangeEvent, JSX } from 'react';

type VolumeSliderProps = {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
};

export const VolumeSlider = ({ label, value, onChange }: VolumeSliderProps): JSX.Element => {
  const percent = Math.round(value * 100);
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(Number(event.target.value) / 100);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={percent}
        onChange={handleChange}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-foreground/15 accent-foreground"
      />
    </div>
  );
};
