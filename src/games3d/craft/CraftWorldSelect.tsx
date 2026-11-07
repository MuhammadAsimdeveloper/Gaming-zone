import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Layers,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SaveSlot } from './save';
import type { SlotSummary } from './saveStore';
import { formatPlaytime, formatUpdated } from './craftUi';

export interface CraftWorldSelectProps {
  slots: SlotSummary[] | null;
  savingAvailable: boolean;
  error: string | null;
  fatal: string | null;
  onRefresh(): void;
  onCreate(slot: SaveSlot, name: string, seed: string): void;
  onContinue(slot: SaveSlot): void;
  onDelete(slot: SaveSlot): void;
  onStartUnsaved(): void;
}

function EmptySlotForm({
  slot,
  onCreate,
  onCancel,
}: {
  slot: SaveSlot;
  onCreate(slot: SaveSlot, name: string, seed: string): void;
  onCancel(): void;
}) {
  const [name, setName] = useState(`Rift World ${slot}`);
  const [seed, setSeed] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onCreate(slot, name, seed);
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <label className="block text-[10px] uppercase tracking-[0.16em] text-muted/70">
        World name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          className="mt-1 w-full rounded-lg border border-white/10 bg-night-950/80 px-2.5 py-1.5 text-xs text-white outline-none focus:border-mint/60"
        />
      </label>
      <label className="block text-[10px] uppercase tracking-[0.16em] text-muted/70">
        Seed (optional)
        <input
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          maxLength={128}
          placeholder="Leave blank for a random world"
          className="mt-1 w-full rounded-lg border border-white/10 bg-night-950/80 px-2.5 py-1.5 text-xs text-white outline-none focus:border-mint/60"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-mint text-xs font-semibold text-night-950"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create and enter
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-full border border-white/12 px-3 text-xs text-muted hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SlotCard({
  summary,
  onCreate,
  onContinue,
  onDelete,
}: {
  summary: SlotSummary;
  onCreate(slot: SaveSlot, name: string, seed: string): void;
  onContinue(slot: SaveSlot): void;
  onDelete(slot: SaveSlot): void;
}) {
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const slot = summary.slot;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70">Slot {slot}</p>
        {summary.status === 'ok' ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-mint">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Day {summary.record.day}
          </span>
        ) : summary.status === 'unreadable' ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-coral">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Unreadable
          </span>
        ) : (
          <span className="text-[10px] text-muted/60">Empty</span>
        )}
      </div>

      {summary.status === 'ok' ? (
        <>
          <p className="mt-1 truncate text-sm font-semibold text-white">{summary.record.name}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">
            {formatPlaytime(summary.record.playSeconds)} played · seed{' '}
            <span className="font-mono text-[10px] text-muted/80">{summary.record.seed}</span>
          </p>
          <p className="text-[10px] text-muted/60">Last played {formatUpdated(summary.record.updatedAt)}</p>
          {confirming ? (
            <div className="mt-3 rounded-xl border border-coral/30 bg-coral/10 p-2">
              <p className="text-[11px] text-coral">Delete this world? This cannot be undone.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onDelete(slot);
                  }}
                  className="h-8 flex-1 rounded-full bg-coral text-[11px] font-semibold text-night-950"
                >
                  Yes, delete world
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-8 rounded-full border border-white/12 px-3 text-[11px] text-muted hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onContinue(slot)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-mint to-electric-500 text-xs font-semibold text-night-950"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Continue
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`Delete world in slot ${slot}`}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-muted hover:border-coral/40 hover:text-coral"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      ) : summary.status === 'unreadable' ? (
        <>
          <p className="mt-1 text-xs font-semibold text-coral">This save cannot be read</p>
          <p className="mt-0.5 text-[10px] leading-4 text-muted/70">{summary.detail}</p>
          <p className="mt-1 text-[10px] text-muted/60">
            It will never be overwritten automatically. Delete it to free the slot.
          </p>
          {confirming ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onDelete(slot);
                }}
                className="h-8 flex-1 rounded-full bg-coral text-[11px] font-semibold text-night-950"
              >
                Delete unreadable slot
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-8 rounded-full border border-white/12 px-3 text-[11px] text-muted hover:text-white"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-coral/30 px-3 text-[11px] text-coral"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete slot
            </button>
          )}
        </>
      ) : creating ? (
        <EmptySlotForm
          slot={slot}
          onCreate={onCreate}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">A fresh seeded world.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3 text-xs font-medium text-mint transition hover:bg-mint/20"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create world
          </button>
        </>
      )}
    </div>
  );
}

export function CraftWorldSelect({
  slots,
  savingAvailable,
  error,
  fatal,
  onRefresh,
  onCreate,
  onContinue,
  onDelete,
  onStartUnsaved,
}: CraftWorldSelectProps) {
  return (
    <div className="relative min-h-[560px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 420px at 80% -10%, rgba(45,212,191,0.18), transparent 65%), radial-gradient(700px 420px at 0% 20%, rgba(56,232,255,0.12), transparent 60%), linear-gradient(180deg, #050814 0%, #07101d 100%)',
        }}
      />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              NeonRift 3D · Voxel sandbox
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Neon <span className="text-gradient">Craft</span>
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
              Mine, build and survive a seeded voxel world with four biomes, caves, ores,
              farming and a full day-night cycle. Every texture, creature and recipe is
              original — nothing is downloaded at runtime.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['Seeded worlds', 'The same seed always builds the same terrain, caves and ores.'],
              ['Survive the night', 'Gloomlings and Cinder Wisps hunt anyone without a lit base.'],
              ['Craft and farm', '33 recipes across hand, workbench and kiln stations.'],
              ['Three save slots', 'IndexedDB autosaves keep each world in this browser.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-white">{title}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted">{body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] leading-5 text-muted">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Desktop controls</p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
              <span><b className="text-ink">WASD</b> move</span>
              <span><b className="text-ink">Space</b> jump</span>
              <span><b className="text-ink">Ctrl / Shift</b> sprint / sneak</span>
              <span><b className="text-ink">Mouse</b> look</span>
              <span><b className="text-ink">Left / right click</b> mine / use</span>
              <span><b className="text-ink">1–9</b> hotbar</span>
              <span><b className="text-ink">E</b> inventory</span>
              <span><b className="text-ink">Q</b> drop · <b className="text-ink">Esc</b> pause</span>
            </div>
            <p className="mt-2 text-[10px] text-muted/60">
              First-person look requires pointer lock; the browser asks for it when a world starts.
              Touch devices get a stick, look pad and action buttons instead.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Worlds</h3>
            {savingAvailable ? (
              <button
                type="button"
                onClick={onRefresh}
                className="text-[11px] text-mint hover:underline"
              >
                Refresh
              </button>
            ) : null}
          </div>

          {!savingAvailable ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-200">
              <p className="font-semibold">Saving is unavailable in this browser.</p>
              <p className="mt-1">
                IndexedDB is blocked or disabled, so worlds cannot be stored. You can still play
                an unsaved world for this session.
              </p>
              <button
                type="button"
                onClick={onStartUnsaved}
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-300 px-3 text-xs font-semibold text-night-950"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Start unsaved world
              </button>
            </div>
          ) : slots === null ? (
            <p role="status" className="rounded-2xl border border-white/10 bg-night-950/60 p-3 text-xs text-muted">
              Reading save slots…
            </p>
          ) : (
            <div className="space-y-2">
              {slots.map((summary) => (
                <SlotCard
                  key={summary.slot}
                  summary={summary}
                  onCreate={onCreate}
                  onContinue={onContinue}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}

          {error ? (
            <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 p-2 text-[11px] text-coral">
              {error}
            </p>
          ) : null}
          {fatal ? (
            <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 p-2 text-[11px] text-coral">
              {fatal}
            </p>
          ) : null}

          <p className="mt-auto flex items-center gap-1 text-[10px] text-muted/60">
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            Saves stay on this device. Unreadable slots are never overwritten.
          </p>
        </div>
      </div>
    </div>
  );
}