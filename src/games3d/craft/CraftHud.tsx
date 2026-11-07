import { Backpack, Heart, Pause, Volume2, VolumeX } from 'lucide-react';
import type { CraftHud } from './engine';
import { itemIcon } from './itemIcon';
import { itemLabel } from './itemView';

const PHASE_LABEL: Record<CraftHud['phase'], string> = {
  day: 'Day',
  dusk: 'Dusk',
  night: 'Night',
  dawn: 'Dawn',
};

const PHASE_COLOR: Record<CraftHud['phase'], string> = {
  day: 'bg-amber-300',
  dusk: 'bg-orange-400',
  night: 'bg-indigo-400',
  dawn: 'bg-mint',
};

export interface CraftHudViewProps {
  hud: CraftHud;
  muted: boolean;
  onPause(): void;
  onToggleMute(): void;
  onOpenInventory(): void;
  onSelectSlot(index: number): void;
}

function ItemGlyph({ id, size }: { id: number; size: string }) {
  const icon = itemIcon(id);
  if (!icon) return null;
  return (
    <img
      src={icon}
      alt=""
      draggable={false}
      className={`${size} [image-rendering:pixelated]`}
    />
  );
}

export function CraftHudView({
  hud,
  muted,
  onPause,
  onToggleMute,
  onOpenInventory,
  onSelectSlot,
}: CraftHudViewProps) {
  const health = Math.max(0, Math.min(20, hud.health));
  const hunger = Math.max(0, Math.min(20, hud.hunger));

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-night-950/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-night-950/85 to-transparent" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.16]"
          style={{ background: 'radial-gradient(circle at 50% 50%, transparent 55%, #02040a 100%)' }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="rounded-xl border border-white/10 bg-night-950/70 px-3 py-2 backdrop-blur-md">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Day {hud.day}</p>
          <p className="font-mono text-lg font-semibold leading-tight text-white">{hud.clock}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${PHASE_COLOR[hud.phase]}`} />
            {PHASE_LABEL[hud.phase]}
            {hud.depth < 30 ? <span className="ml-1 text-amber-300">Depth {Math.round(Math.max(0, hud.depth))}</span> : null}
            {hud.underwater ? <span className="ml-1 text-electric-400">Underwater</span> : null}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenInventory}
            aria-label="Open inventory"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            <Backpack className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause world"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-white/80" />
        <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/80" />
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      </div>

      {hud.toast ? (
        <p
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-mint/30 bg-night-950/85 px-4 py-1.5 text-xs font-semibold text-mint backdrop-blur-md"
        >
          {hud.toast}
        </p>
      ) : null}

      {hud.prompt ? (
        <p className="pointer-events-none absolute left-1/2 top-[calc(50%+28px)] -translate-x-1/2 rounded-full border border-white/15 bg-night-950/75 px-3 py-1 text-[11px] text-white/90 backdrop-blur-md">
          {hud.prompt}
        </p>
      ) : null}

      {hud.mining > 0 ? (
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%+58px)] w-32 -translate-x-1/2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint to-electric-400"
              style={{ width: `${Math.round(hud.mining * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-4 sm:p-4">
        <div className="flex w-full items-end justify-between gap-3">
          <div className="w-28 space-y-1.5 rounded-xl border border-white/10 bg-night-950/60 px-2 py-1.5 backdrop-blur-md sm:w-36">
            <div>
              <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-white/50">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-2.5 w-2.5" aria-hidden="true" /> Health
                </span>
                <span>{Math.round(health)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-coral to-rose-400"
                  style={{ width: `${(health / 20) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-white/50">
                <span>Hunger</span>
                <span>{Math.round(hunger)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200"
                  style={{ width: `${(hunger / 20) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex gap-1.5 rounded-2xl border border-white/10 bg-night-950/65 p-1.5 backdrop-blur-md" role="group" aria-label="Hotbar">
            {hud.hotbar.map((slot, index) => {
              const selected = index === hud.selected;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectSlot(index)}
                  aria-pressed={selected}
                  aria-label={
                    slot
                      ? `Hotbar slot ${index + 1}: ${itemLabel(slot.id)} x${slot.count}`
                      : `Hotbar slot ${index + 1}: empty`
                  }
                  className={`relative grid h-10 w-10 place-items-center rounded-lg border transition sm:h-11 sm:w-11 ${
                    selected
                      ? 'border-white/80 bg-white/15'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/30'
                  }`}
                >
                  {slot ? <ItemGlyph id={slot.id} size="h-7 w-7" /> : null}
                  {slot && slot.count > 1 ? (
                    <span className="absolute bottom-0 right-1 font-mono text-[10px] font-semibold text-white drop-shadow">
                      {slot.count}
                    </span>
                  ) : null}
                  <span className="absolute left-1 top-0.5 font-mono text-[8px] text-white/40">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden w-28 text-right text-[10px] leading-4 text-muted/70 sm:block sm:w-36">
            <p><b className="text-ink">E</b> inventory</p>
            <p><b className="text-ink">Esc</b> pause</p>
          </div>
        </div>
      </div>
    </>
  );
}